import SocketIo from 'socket.io';
import Debug from 'debug';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import redis, { getSocketId } from './db/redis';
import config from '../config';
import { selectUser } from './db/db';
import { dataMessage, sendNotification } from './fcm';
import fileConfig from '../file_config';
import { getProfileImage } from './index';
const debug = Debug('socket.io');
const createSocket = (server) => {
  const io = new SocketIo(server);
  io.use((socket, next) => {
    try {
      const query = socket.handshake.query;
      if (query) {
        jwt.verify(query.jwt_token, config.secret, (err, decoded) => {
          if (err) {
            debug('token invaild');
            // throw new Error('token invaild');
          } else {
            socket.info = decoded;
            redis.hset('socket_list', decoded.id, socket.id);
            redis.hset('fire_base_token_list', decoded.id, query.fire_base_token);
            next();
          }
        });
      } else {
        debug('token empty');
        throw new Error('token empty');
      }
    } catch (exception) {
      next(exception);
    }
  });

  io.on('connection', (socket) => {
    debug(`socket info ${socket.info.id}  name : ${socket.info.name}`);
    debug(`socket connected socket id : ${socket.id}`);
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
        debug(`data ${data}`);
        selectUser(['id', 'name'], function () {
          this.where('id', 'like', `%${data}%`).whereNot({
            id: socket.info.id,
          });
        }).then((results) => {
          debug('search_friends_result send');
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
          debug(`reuslt ${err}`);
        });
      } catch (err) {
        debug(err);
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
      debug('invite_to_chat');
      const convertedData = JSON.parse(data);
      // insertMessage(convertedData);
      // console.log(convertedData);
      const message = convertedData.message;
      const sender = convertedData.chatRoom.talkTo;
      const chatRoom = convertedData.chatRoom;
      const receiver = convertedData.receiver;
      test( [ sender ] ).then ( () => {
        sendToMember( receiver.id, sendData( JSON.stringify(convertedData), io, socket, 'invite_to_personal_chat' ) );
      }).catch( err => debug(`err ${err}`))
    });

    socket.on('invite_group_chat', (data, ack) => {
      debug('invite_group_chat');
      const parsedData = JSON.parse(data);
      const chatRoom  = parsedData.chatRoom;
      const users = chatRoom.users;
      const usersId = users.map( obj => obj.id);
      redis.sadd(chatRoom.chatId, usersId).then((result) => {
        
      });
      
      test( users ).then( () => {
        sendToMembers( parsedData.sender, usersId, sendData( JSON.stringify(parsedData), io, socket, 'invite_group_chat' ) );
        ack(true);
      });
    });
    socket.on('send_group_message', data => {
      debug('send_group_message');
      const convertedData = JSON.parse(data);
      const message = convertedData.message;
      const chatRoom = convertedData.chat_room;
      redis.SMEMBERS(message.chatId).then( members => {
        sendToMembers( message.creatorId, members, sendData( data, io, socket, 'send_group_message' ) );
      });
    });
    socket.on('chat_read', (data) => {
      debug(`chat_read`);
      const mData = JSON.parse(data);
      const chatId = mData.chat_id;
      const chatType = mData.chatType;
      const messageIdList = mData.messages;
      const sender = mData.from;
      debug(`chat_read ${sender}`);
      // sendChatToMember(mData, io, socket, sender, null, 'chat_read');
      redis.smembers(chatId).then( members => {
        // sendToMembers( sender, mData, io, socket, users, 'chat_read' );
        sendToMembers( sender, members, sendData( data, io, socket, 'chat_read' ) );
      }) 
    });

    socket.on('disconnect', () => {
      redis.hdel('socket_list', socket.info.id);
      debug(`disconnect ${socket.info.name}`);
    });
  });
  return io;
};
const test = ( users ) => {
  let list = [];
  for ( let user of users) {
    list.push( getProfileImage(user.id).then( img => { 
      if( img ){
        user.img = img;
        user.hasProfileImg = true;
      }
      else 
        user.hasProfileImg = false;
      })
      .catch( err => debug(` err ${err}`))
    );
  }
  return Promise.all(list);
};
const sendToMember = ( receiver, sendToUser ) => {
  debug(`method : sendToMember // send to ${receiver}`);
  getSocketId(receiver).then( socketId => {
    sendToUser(receiver, socketId);
  })
}

const sendToMembers = ( sender, members, sendToUser ) => {
  for ( const member of members ) {
    if ( sender !== member ) {
      debug(`method : sendToMembers // send to ${member}`);
      getSocketId(member).then( socketId => {
        // sendInvite( member, socketId, io, emitParam, data);
        sendToUser(member, socketId);
      })
    }
  }
}

const sendData = ( data, io, socket, emitParam ) => {
    return ( userId, socketId ) => {
        if ( io.sockets.connected[socketId] ) {
          debug(`userId ${userId} is connected `)
          debug(`send emit  param ${emitParam}`)
          io.sockets.connected[socketId].emit(emitParam, data);
        } else {
          debug(`userId ${userId} not connected `)
          storeNotificationToRedis(userId, data)
          .then( rows => getFireBaseToken(userId))
          .then( token => {
            debug(`${userId} token : ${token}`)
            //send notification;
          })
          .catch( err => debug(`err ${err}`));
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
    debug('socketId');
    io.sockets.connected[socketId].emit(emitParam, data);
  } else {
    debug('userId');
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
export default createSocket;
