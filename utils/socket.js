import SocketIo from 'socket.io';
import Debug from 'debug';
import jwt from 'jsonwebtoken';
import redis, { getSocketId, isLogin } from './db/redis';
import config from '../config';
import { selectUser, createChatRoom, insertMessage, readMessage, addFriend, 
  insertPersonalMessage, insert, del, getAllUsers, getMyChatRoomsId, getMyChatRoom, getMyMessages, getMyChatMembers } from './db/db';
import { dataMessage, sendNotification } from './fcm';
import fileConfig from '../file_config';
import { getProfileImage, findUserImg, profileImageRead } from './index';
import { generateSha1 } from './crypto';
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
            const isTemporary = query.isTemporary;
            if ( !isTemporary ) {
              redis.hset('socket_list', decoded.id, socket.id);
              redis.hset('fire_base_token_list', decoded.id, query.fire_base_token);
            }
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
      findUserImg( [ sender ] ).then ( () => {
        sendToMember( receiver.id, sendData( JSON.stringify(convertedData), io, socket, 'invite_to_personal_chat' ) );
        insertPersonalMessage(convertedData);
      }).catch( err => debug(`err ${err}`))
    });

    socket.on('invite_group_chat', (data, ack) => {
      debug('invite_group_chat');
      const parsedData = JSON.parse(data);
      const chatRoom  = parsedData.chatRoom;
      const users = chatRoom.users;
      const usersId = users.map( obj => obj.id );
      redis.sadd(chatRoom.chatId, usersId).then((result) => {
        
      });
      
      findUserImg( users ).then( () => {
        sendToMembers( parsedData.sender, usersId, sendData( JSON.stringify(parsedData), io, socket, 'invite_group_chat' ) );
        createChatRoom(parsedData);
        ack(true);
      });
    });
    socket.on('send_group_message', data => {
      debug('send_group_message');
      const convertedData = JSON.parse(data);
      console.log(convertedData)
      const message = convertedData.message;
      const chatRoom = convertedData.chat_room;
      redis.SMEMBERS(message.chatId).then( members => {
        sendToMembers( message.creatorId, members, sendData( data, io, socket, 'send_group_message' ) );
        insertMessage(convertedData)
      });

    });
    socket.on('chat_read', (data) => {
      debug(`chat_read`);
      const mData = JSON.parse(data);
      const chatId = mData.chat_id;
      const chatType = mData.chatType;
      const messageIdList = mData.messages;
      const sender = mData.sender;
      debug(`chat_read ${sender}`);
      // sendChatToMember(mData, io, socket, sender, null, 'chat_read');

      if ( chatType == 1 ) {
        debug(`chatType 1`);
        const receiver = mData.receiver;
        sendToMember( receiver, sendData( data, io, socket, 'chat_read' ) )
      } else if (  chatType == 2 ) {
        redis.smembers(chatId).then( members => {
        // sendToMembers( sender, mData, io, socket, users, 'chat_read' );
        sendToMembers( sender, members, sendData( data, io, socket, 'chat_read' ) );
        }) 
      } 
      readMessage(mData);
    });
    socket.on('invite_friend', ( data, ack ) => {
      const parsedData = JSON.parse(data);
      const chatId = parsedData.chat_id;
      const users = parsedData.users;
      const ids = parsedData.users.map( obj => obj.id);
      const event = parsedData.event;
      const sender = parsedData.sender;
      const chatRoom = parsedData.chatRoom;
      const members = chatRoom.users;
      
      findUserImg( members )
      .then( findUserImg( users ) )
      .then( () => redis.smembers(chatId) )
      .then( result => {
        // 이미 그룹챗에 있는 친구들에게 보냄
        sendToMembers( sender, result, sendData( JSON.stringify({ event, sender, chat_id: chatId, users }), io, socket, event ) );
      })
      .then( () => {
        //새로 추가 되는 친구들에게 보내는 챗 정보
        const event = 'invite_group_chat';
        sendToMembers( sender, ids, sendData( JSON.stringify({ event, chatRoom }), io, socket, event ))
      })
      .then( () => {
        ack(true);
        redis.sadd(chatId, ids);
      })
      addFriend(users, chatRoom);
    })
    socket.on('add_friend', id =>{
      debug(`add_friend`)
      insert('friends', { user_id : socket.info.id, friend_id: id } )
      .then( result => debug( `add friend result ${result}`))
    })
    socket.on('delete_friend', id => {
      del('friends',  { user_id : socket.info.id, friend_id: id } )
      .then( result => debug( `del friend result ${result}`))
    })
    socket.on('file_upload_start', data =>{

    })
    socket.on('file_upload', data => {

    })
    socket.on('file_upload_end', data => {

    })
    socket.on('echo', data =>{
      socket.emit("end");
      debug(`echo`);
    })
    socket.on('if_login', data => {
      const id = socket.info.id;
      getAllUsers(id).then( results => {
        debug(console.log(results))
        let list = []; 
        results.map( users => list.push(...users));
        return Promise.all(list.map( user => profileImageRead(user)))
      })
      .then( results => {
        results.map( user => socket.emit('send_initial_state', JSON.stringify({ event: 'user', payload: user })));
        return getMyChatRoomsId(id, 'chat_id')
      })
      .then( chatIds => getMyChatRoom( chatIds.map( id => id.chat_id), ['chat_id', 'chat_type', 'chat_name'] ))
      .then( chatRooms => {
        chatRooms.map( chatRoom => socket.emit('send_initial_state', JSON.stringify({ event: 'chatRoom', payload: chatRoom[0] })))
        return getMyMessages(id);
      })
      .then( messages => {
        messages.map( message => socket.emit('send_initial_state', JSON.stringify({ event: 'message', payload: message })))
        return getMyChatMembers(id)
      })
      .then( members => {
        members.map( member => socket.emit('send_initial_state', JSON.stringify({ event: 'chat_members', payload: member })))
      })
      .then( () => {
        socket.emit('send_initial_state', JSON.stringify( { event: 'end', payload: true }))
      })
      .catch( err => console.log(err))
    })
    // socket.on('get_my_all_messages', ( data, ack ) => {
      
    
    // redis.del(`${socket.info.id}-messages`);
    

    // })

    socket.on('send_event_and_message', (data) => {
      debug('send_event_and_message')
      emitMyMessages( socket )
      .then(emitMyEvents(socket))
      .then( () => debug(`send success`))
      .catch ( err => debug(err) )
    })
    socket.on('send_notification_data', key => {
      debug(`send_notification_data`)
      redis.hget(`${socket.info.id}-messages`, key)
      .then( data => {
        if ( data ) {
          socket.emit( 'send_notification_data', data );
        }
      })
      .then( () => {
        return redis.hdel( `${socket.info.id}-messages`, key )
      })
      .then ( result => {
        socket.emit('end');
        debug(result)
      })
    })
    socket.on('disconnect', () => {
      redis.hdel('socket_list', socket.info.id);
      debug(`disconnect ${socket.info.name}`);
    });
  });
  return io;
};


const sendToMember = ( receiver, sendToUser ) => {
  debug(`method : sendToMember // send to ${receiver}`);
  isLogin(receiver)
  .then( result => {
    if ( result ) {
      return getSocketId(receiver)
    } else {
      throw `${receiver} is not logined so can't emit`;
    }
  })
  .then( socketId => {
    sendToUser(receiver, socketId);
  })
  .catch( err => debug( err ) )
  
}

const sendToMembers = ( sender, members, sendToUser ) => {
  for ( const member of members ) {
    if ( sender !== member ) {
      debug(`method : sendToMembers // send to ${member}`);
      isLogin(member).then( result => result)
      .then( result => {
        if( result ) 
          return getSocketId(member);
        else
          throw `${member} is not logined so can't emit`;
      })
      .then( socketId => {
        sendToUser(member, socketId);
      })
      .catch ( err => debug(err) )
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
          if ( emitParam  === 'invite_group_chat' || emitParam === 'send_group_message' || emitParam === 'invite_to_personal_chat' ) {
            debug(`userId ${userId} not connected `)
            const key = generateSha1(Date.now('milli').toString());
            storeNotificationToRedis(userId, key, data)
            .then( rows => getFireBaseToken(userId))
            .then( token => {
              debug(`${userId} token : ${token}`)
              const message = dataMessage(token, { key });
              return sendNotification(message);
            })
            .then(() => {
              console.log('notification success');
            })
            .catch( err => debug(`err ${err}`));
          } else {
            storeEventToRedis(userId, data)
            .then( result => debug(result))
          }
      } 
    }
}
const storeNotificationToRedis = (userId, key, data) => {
  return redis.hset(`${userId}-messages`, key, data);
}
const storeEventToRedis = ( userId, data ) => {
  return redis.rpush(`${userId}-events`, data)
}
const getFireBaseToken = ( userId ) => {
  return redis.hget('fire_base_token_list', userId);
}

const emitMyEvents = ( socket ) => {
  return redis.llen(`${socket.info.id}-events`)
  .then( size => {
       if ( size > 0 ) 
         return redis.LRANGE(`${socket.info.id}-events`, 0, -1);
        else
        throw `${socket.info.id}-events is empty`
  })
  .then( results => {
      for ( let i = 0; i < results.length; i++ ) {
        const data = JSON.parse(results[i]);
        const event = data.event;
        socket.emit(event, results[i]);
      }
      redis.del(`${socket.info.id}-events`);
  })
  .catch ( err => debug(err) )
}
const emitMyMessages = ( socket ) => {
  return redis.hvals(`${socket.info.id}-messages`)
    .then( messages => {
      for ( const message of messages.reverse() ) {
        const data = JSON.parse(message)
        const event = data.event
        socket.emit(event, message)
      }
    })
    .then(redis.del(`${socket.info.id}-messages`))
}
// const sendChat = (userId, socketId, io, emitParam, data) => {
//   if (io.sockets.connected[socketId]) {
//     debug('socketId');
//     io.sockets.connected[socketId].emit(emitParam, data);
//   } else {
//     debug('userId');

//       const key = generateSha1(Date.now('milli'));
//       debug( key )
//       redis.hset(`${userId}-messages`, key, data)
//       .then( token => redis.hget('fire_base_token_list', userId))
//       .then( token => {
//         console.log('notification result ');
        
//       })
      
//       .catch((err) => {
//         console.log(`err ${err}`);
//       });
//     } else {
      
//     }
    
//   }
// };


const createSocketResultData = (result, message_id, chat_id) => ({
  result,
  message_id,
  chat_id,
});
export default createSocket;
