import SocketIo from 'socket.io';
import debug from 'debug';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import redis, { getSocketId } from './db/redis';
import config from '../config';
import { selectUser } from './db/db';
import { dataMessage, sendNotification } from './fcm';
import fileConfig from '../file_config';
import { getProfileImage } from './index';
const dubuger = debug('socket.io');
const createSocket = (server) => {
  const io = new SocketIo(server);
  io.use((socket, next) => {
    try {
      const query = socket.handshake.query;
      if (query) {
        jwt.verify(query.jwt_token, config.secret, (err, decoded) => {
          if (err) {
            dubuger('token invaild');
            // throw new Error('token invaild');
          } else {
            socket.info = decoded;
            redis.hset('socket_list', decoded.id, socket.id);
            redis.hset('fire_base_token_list', decoded.id, query.fire_base_token);
            next();
          }
        });
      } else {
        dubuger('token empty');
        throw new Error('token empty');
      }
    } catch (exception) {
      next(exception);
    }
  });

  io.on('connection', (socket) => {
    dubuger(`socket info ${socket.info.id}  name : ${socket.info.name}`);
    dubuger(`socket connected socket id : ${socket.id}`);
    redis.LRANGE(`${socket.info.id}-messages`, 0, -1).then((results) => {
      for (const result of results) {
        const data = JSON.parse(result);
        const event = data.event;
        socket.emit(event, result);
        // console.log(JSON.parse(result));
      }
    });
    redis.del(`${socket.info.id}-messages`);
    socket.on('chat message', (data) => {
      console.log(data);
    });

    socket.on('search_friends', (data) => {
      try {
        if (!data || data.length < 4) {
          throw new Error('data is empty');
        }
        dubuger(`data ${data}`);
        selectUser(['id', 'name'], function () {
          this.where('id', 'like', `%${data}%`).whereNot({
            id: socket.info.id,
          });
        }).then((results) => {
          dubuger('search_friends_result send');
          const getImagePromise = [];
          for (const user of results) {
            getImagePromise.push(profileImageRead(user));
          }
          return Promise.all(getImagePromise);
        }).then((results) => {
          socket.emit('search_friends_result', {
            msssageType: 0,
            message: 'search_success',
            data: results,
          });
        }).catch((err) => {
          dubuger(`reuslt ${err}`);
        });
      } catch (err) {
        dubuger(err);
        socket.emit('search_friends_result', {
          msssageType: 1,
          message: 'input data invaild',
        });
      }
    });
    socket.on('get_my_info', (data) => {
      selectUser('*', {
        id: data,
      }).then((result) => {
        console.log(result);
        socket.emit('receive_user_info', {
          messageType: 0,
          message: 'get_info_success',
          data: reuslt,
        });
      }).catch((err) => {
        socket.emit('receive_user_info', {
          messageType: 1,
          message: 'get_info_fail',
        });
      });
    });
    socket.on('invite_to_personal_chat', (data) => {
      dubuger('invite_to_chat');
      const convertedData = JSON.parse(data);
      console.log(convertedData);
      // insertMessage(convertedData);
      // console.log(convertedData);
      const message = convertedData.message;
      const chatRoom = convertedData.chat_room;
      const receive = convertedData.receive;
      const from = convertedData.from;
      sendChatToMember(convertedData, io, socket, convertedData.receive.user_id, createSocketResultData(true, message.message_id, chatRoom.chat_id), 'invite_to_personal_chat');
    });

    socket.on('invite_group_chat', (data, ack) => {
      dubuger('invite_group_chat');
      const parsedData = JSON.parse(data);
      const chatRoom  = parsedData.chatRoom;
      const users = chatRoom.users;
      const usersId = users.map( obj => obj.id);
      redis.sadd(chatRoom.chatId, usersId).then((result) => {
        
      });
      test(parsedData, usersId).then( newData => {
        sendChatToMembers(newData, io, socket, usersId, null, 'invite_group_chat');
        ack(true);
      });
    });
    socket.on('send_group_message', (data) => {
      dubuger('send_group_message');
      const convertedData = JSON.parse(data);
      const message = convertedData.message;
      const chatRoom = convertedData.chat_room;
      redis.SMEMBERS(message.chatId).then( users => {
        sendToGroupchat(message.creatorId, data, io, socket, users, null, 'send_group_message');
      });
    });

    socket.on('chat_read', (data) => {
      dubuger(`chat_read`);
      const mData = JSON.parse(data);
      const chatId = mData.chat_id;
      const chatType = mData.chatType;
      const messageIdList = mData.messages;
      const sender = mData.from;
      dubuger(`chat_read ${sender}`);
      // sendChatToMember(mData, io, socket, sender, null, 'chat_read');
      redis.smembers(chatId).then( users => {
        sendToMembers( sender, mData, io, socket, users, 'chat_read' );
      }) 
    });

    socket.on('disconnect', () => {
      redis.hdel('socket_list', socket.info.id);
      dubuger(`disconnect ${socket.info.name}`);
    });
  });
  return io;
};
const test = ( data, userIdList ) => {
  let list = [];
  for ( let user of data.chatRoom.users ) {
    list.push( getProfileImage(user.id).then( img => { 
      // data.users[user].profileImage = img;
      if( img ){
        user.img = img;
        user.hasProfileImg = true;
      }
      else 
        user.hasProfileImg = false;
      })
    );
  }
  return Promise.all(list).then( () => data );
};
const profileImageRead = user => new Promise((resolve, reject) => {
  const resize = fileConfig.resize;
  const filePath = path.join(__dirname, '..', 'public', 'images', 'profile', `${user.id}`, `${resize}x${resize}.png`);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      user.img = null;
      resolve(user);
    } else {
      user.img = new Buffer(data, 'binary').toString('base64');
    }
    resolve(user);
  });
});
const createSocketResultData = (result, message_id, chat_id) => ({
  result,
  message_id,
  chat_id,
});


const sendChatToMember = (data, io, socket, member, chatResult, emitParam) => {
  getSocketId(member).then((id) => {
    dubuger(`id ${id}`);
    sendChat(member, id, io, emitParam, data);
  });
  if (chatResult) {
    socket.emit('invite_result', chatResult);
  }
};

const sendToMembers = ( sender, data, io, socket, members, emitParam ) => {
  for ( const member of members ) {
    if ( sender !== member ) {
      getSocketId(member).then( socketId => {
        sendInvite( member, socketId, io, emitParam, data);
      })
    }
  }
}

const sendChatToMembers = ( data, io, socket, members, chatResult, emitParam ) => {

  for (const member of members) {
    if (member !== data.creator) {    
      // if( true ) {
      getSocketId(member).then( socketId => {
        sendInvite(member, socketId, io, emitParam, data);
      });
    }
  }
  if( chatResult ) {
    socket.emit('invite_result', chatResult);
  }
};
const sendInvite = ( targetId, socketId, io, emitParam, data ) => {
  const stringData = JSON.stringify(data);
  if (io.sockets.connected[socketId]) {
    dubuger(`target id : ${targetId} emitParm : ${emitParam}`);
    io.sockets.connected[socketId].emit(emitParam, stringData);
  } else {
    dubuger('userId');
    storeNotificationToRedis(targetId, stringData)
    .then( (rows) => getFireBaseToken(targetId))
    .then( token => {
      console.log(token);
      //send notification;
    })
    .catch( err => console.log(`err ${err}`));
  }
}
const sendToGroupchat = (creator, data, io, socket, members, chatResult, emitParam ) => {
  
  for( const user of members ) {
    if ( creator !== user ) {
      getSocketId(user).then( socketId => {
        if (io.sockets.connected[socketId]) {
          io.sockets.connected[socketId].emit(emitParam, data);
        } else {
          storeNotificationToRedis(user, data)
          .then( (rows) => getFireBaseToken(user))
          .then( token => {
          console.log(token);
          //send notification;
          })
          .catch( err => console.log(`err ${err}`));
        }
      });
    }
  }
}
const storeNotificationToRedis = (userId, data) => {
  return redis.RPUSH(`${userId}-messages`, data);
}
const getFireBaseToken = ( userId ) => {
  return redis.hget('fire_base_token_list', userId);
}

const sendChat = (userId, socketId, io, emitParam, data) => {
  if (io.sockets.connected[socketId]) {
    dubuger('socketId');
    io.sockets.connected[socketId].emit(emitParam, data);
  } else {
    dubuger('userId');
    redis.RPUSH(`${userId}-messages`, JSON.stringify(data)).then(token => redis.hget('fire_base_token_list', userId)).then((token) => {
      console.log('notification result ');
      const message = dataMessage(token, { hi: 'hello world', chat_type: 1 });
      return sendNotification(message);
        // TODO : handle notification
      // return true;
    }).then(() => {
      console.log('notification success');
    })
    .catch((err) => {
      console.log(`err ${err}`);
    });
  }
};

export default createSocket;
