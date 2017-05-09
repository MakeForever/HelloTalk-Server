import socketIo from 'socket.io';
import debug from 'debug';
import redis from './db/redis'
import jwt from 'jsonwebtoken';
import config from '../config';
import {
  selectUser
} from './db/db';
import fs from 'fs';
import path from 'path';
import fileConfig from '../file_config';
const dubuger = debug('socket.io');
const createSocket = (server) => {
  let io = new socketIo(server);
  io.use((socket, next) => {
    const token = socket.handshake.query.token;
    try {
      if (token) {
        jwt.verify(token, config.secret, (err, decoded) => {
          if (err) {
            dubuger(`token invaild`);
            throw new Error('token invaild');
          } else {
            dubuger(`decoded id ${decoded.id}  name : ${decoded.name}`)
            // redis.hget('idList', decoded).then((value) => {
            //   if (value === socket.handshake.query.token){
            //     dubuger(`token check success`);
            //     socket.name = decoded;
            //     dubuger(`socket id ${ socket.id }`);
            //     dubuger(`socket name ${ socket.name }`);
            //     next();
            //   } else {
            //     throw new Error('token not founded');
            //   }
            // })
            socket.info = decoded;
            redis.hset('socket_list', decoded.id, socket.id);
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
    dubuger(`socket connected socket id : ${socket.id}`);
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
    socket.on('send_chat', data => {
      const val = JSON.parse(data);

      if (!!val.members) {
        if (redis.exists(val.chatTableName)) {
          redis.sadd('chat_list', val.chatTableName);
          redis.sadd(val.chatTableName, [...val.members, val.sender])
        }
        for (let member of val.members) {
          dubuger(`member :  ${member}`);
          redis.hget('socket_list', member).then((value) => {
            dubuger(`value :  ${value}`);
            if (!value) {
              //TODO : notification
            }
            
            if (io.sockets.connected[value]) {
              dubuger(`is connected :  ${member}`);
              io.sockets.connected[value].emit('receive_chat', val);
            }
          })
        }
      } else {
        redis.smembers(val.chatTableName, (err, values) => {
          for (const member of values) {
            redis.hget('socket_list', member).then((value) => {
              dubuger(`value :  ${value}`);
              if (!value) {
                //TODO : notification
              }
              if ((val.sender !== member ) && io.sockets.connected[value]) {
                dubuger(`is connected :  ${member}`);
                io.sockets.connected[value].emit('receive_chat', val);
              }
            })
          }
        })
      }
      socket.emit("chat_result", {
        result: true,
        insertedChatRowNumber: val.insertedChatRowNumber,
        chatTableName: val.chatTableName
      });
    })

    socket.on('disconnect', (test) => {
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

export default createSocket