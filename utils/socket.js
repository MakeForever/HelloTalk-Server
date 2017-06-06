import socketIo from 'socket.io';
import debug from 'debug';
import redis, { addChatToRedis, getSocketId } from './db/redis'
import jwt from 'jsonwebtoken';
import config from '../config';
import { selectUser } from './db/db';
import fs from 'fs';
import path from 'path';
import { dataMessage, fcm, sendNotification } from './fcm';
import fileConfig from '../file_config';
import { insertMessage, messageFieldsCreator } from './db/db';
const dubuger = debug('socket.io');
const createSocket = (server) => {
  let io = new socketIo(server);
  io.use((socket, next) => {
    try {
      const query = socket.handshake.query;
      if (query) {
        jwt.verify(query.jwt_token, config.secret, (err, decoded) => {
          if (err) {
            dubuger(`token invaild`);
            // throw new Error('token invaild');
          } else {
          
            socket.info = decoded;
            redis.hset('socket_list', decoded.id, socket.id);
            redis.hset('fire_base_token_list', decoded.id, query.fire_base_token);
            next();
          }
        })
      } else {
        dubuger(`token empty`);
        throw new Error('token empty');
      }
    } catch (exception) {
      next(exception);
    }
  });

  io.on('connection', (socket) => {
    dubuger(`socket info ${socket.info.id}  name : ${socket.info.name}`)
    dubuger(`socket connected socket id : ${socket.id}`);
    redis.LRANGE(`${socket.info.id}-messages`, 0, -1).then( results => {
      for( let result of results ) {
        socket.emit('invite_to_personal_chat', JSON.parse(result) );
        // console.log(JSON.parse(result));
      }
    })
    redis.del(`${socket.info.id}-messages`);
    socket.on('chat message', (data) => {
      console.log(data);
    });

    socket.on('search_friends', (data) => {
      try {
        if (!data || data.length < 4) {
          throw new Error("data is empty");
        }
        dubuger(`data ${data}`);
        selectUser(['id', 'name'], function () {
          this.where('id', 'like', `%${data}%`).whereNot({
            id: socket.info.id
          })
        }).then((results) => {
          dubuger(`search_friends_result send`);
          let getImagePromise = [];
          for (let user of results) {
            getImagePromise.push(profileImageRead(user));
          };
          return Promise.all(getImagePromise);
        }).then((results) => {
          socket.emit('search_friends_result', {
            msssageType: 0,
            message: 'search_success',
            data: results
          });
        }).catch((err) => {
          dubuger(`reuslt ${err}`);
        });
      } catch (err) {
        dubuger(err);
        socket.emit('search_friends_result', {
          msssageType: 1,
          message: 'input data invaild'
        });
      }
    });
    socket.on('get_my_info', (data) => {
      selectUser('*', {
        id: data
      }).then((result) => {
        console.log(result);
        socket.emit('receive_user_info', {
          messageType: 0,
          message: 'get_info_success',
          data: reuslt
        })
      }).catch((err) => {
        socket.emit('receive_user_info', {
          messageType: 1,
          message: 'get_info_fail'
        })
      });
    });
    socket.on('invite_to_personal_chat', data => {
      dubuger(`invite_to_chat`);
      const convertedData = JSON.parse(data);
      // insertMessage(convertedData);
      // console.log(convertedData);
      const message = convertedData.message;
      const chatRoom = convertedData.chat_room;
      const receive = convertedData.receive;
      const from = convertedData.from;
      sendChatToMember(convertedData, io, socket, convertedData.receive.user_id, createSocketResultData(true, message.message_id, chatRoom.chat_id), 'invite_to_personal_chat');
      // sendChatToMembers(convertedData, io, socket, convertedData.members, createSocketResultData(true, convertedData.message_id, convertedData.chat_id), 'invite_to_chat');
    })
    socket.on('chat_read', data => {
      const mData = JSON.parse(data);
      const chat_id = mData.chat_id;
      const messageIdList = mData.message_id_list;
      const sender = mData.from;
      dubuger(`chat_read ${sender}` );
      sendChatToMember(mData, io, socket, sender, null, 'chat_read');

    })
   
    socket.on('disconnect', () => {
      redis.hdel('socket_list', socket.info.id);
      dubuger(`disconnect ${socket.info.name}`);
    });
  });
  return io;
}

const profileImageRead = (user) => {
  return new Promise((resolve, reject) => {
    const resize = fileConfig.resize;
    let filePath = path.join(__dirname, '..', 'public', 'images', 'profile', `${user.id}`, `${resize}x${resize}.png`);
    fs.readFile(filePath, (err, data) => {
      if (err) {
        user.img = null;
        resolve(user);
      } else {
        user.img = new Buffer(data, 'binary').toString('base64');
      }
      resolve(user);
    })
  });
}
const createSocketResultData = (result, message_id, chat_id) => {
  return {
    result,
    message_id,
    chat_id
  }
}
const sendChatToMember = (data, io, socket, member, chatResult, emitParam) => {
  getSocketId(member).then(id => {
    dubuger(`id ${id}`);
    sendChat(member, id, io, emitParam, data);
  })
  if( !!chatResult ) {
    socket.emit("invite_result", chatResult);
  }
}
const sendChatToMembers = (data, io, socket, members, chatResult, emitParam) => {
  for (let member of members) {
    if (member.user_id === data.creator_id) {
      return;
    }
    getSocketId(member.user_id).then( id => {
      sendChat(member.user_id, id, io, emitParam, data);
    })
  }
  socket.emit("invite_result", chatResult);
}

const sendChat = (userId, socketId, io, emitParam, data) => {
  if( io.sockets.connected[socketId]) {
    dubuger(`socketId`)
      io.sockets.connected[socketId].emit(emitParam, data);
  } else {
    dubuger(`userId`)
      redis.RPUSH(`${userId}-messages`, JSON.stringify(data)).then( token => {
        return redis.hget('fire_base_token_list', userId);
      }).then( token => {
        console.log(`notification result `)
        const message = dataMessage(token, {hi:'hello world', chat_type:1});
        return sendNotification(message);
      }).then( result => {
        console.log(`notification success`)
      }).catch( err =>{
        console.log(`err ${err}`);
      })
  }
}
export default createSocket