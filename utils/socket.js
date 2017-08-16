import SocketIo from 'socket.io';
import Debug from 'debug';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import knex from './db/knex';
import redis, { getSocketId, isLogin } from './db/redis';
import config from '../config';
import { selectUser, createChatRoom, insertMessage, readMessage, addChatMember, 
  insertPersonalMessage, insert, del, select, getAllUsers, getMyChatRoomsId, getMyChatRoom, 
  getMyMessages, getMyChatMembers, leaveGroupChatRoom, leavePersonalChatRoom, findMyChatMembers,
  messageFieldsCreator} from './db/db';
import { dataMessage, sendNotification } from './fcm';
import fileConfig from '../file_config';
import { getProfileImage, findUserImg, profileImageRead, systemMessageCreator } from './index';
import { generateSha1 } from './crypto';
import debug from './debug';
// const debug = Debug('socket.io');
const log = debug('socket.io');

const createSocket = (server) => {
  const io = new SocketIo(server);
  io.use((socket, next) => {
    try {
      const query = socket.handshake.query;
      if (query) {
        jwt.verify(query.jwt_token, config.secret, (err, decoded) => {
          if (err) {
            log.d(`${decoded.id} token invaild`);
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
        log.d(`token empty`);
        throw new Error('token empty');
      }
    } catch (exception) {
      next(exception);
    }
  });

  io.on('connection', (socket) => {
    // debug(`socket info ${socket.info.id}  name : ${socket.info.name}`);
    log.d(`socket info :${socket.info.id}  name : ${socket.info.name} socket id : ${socket.id}`);
    socket.on('search_friends', (data) => {
      try {
        if (!data || data.length < 4) {
          throw new Error('data is empty');
        }
        // log.d(`data ${data}`);
        selectUser(['id', 'name'], function () {
          this.where('id', 'like', `%${data}%`).whereNot({
            id: socket.info.id,
          });
        }).then((results) => {
          // log.d('search_friends_result send');
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
          log.d(`reuslt ${err}`);
        });
      } catch (err) {
        // log.d(err);
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
      const convertedData = JSON.parse(data);
      const message = convertedData.message;
      const sender = convertedData.chatRoom.talkTo;
      const chatRoom = convertedData.chatRoom;
      const receiver = convertedData.receiver;
      log.d(`${socket.info.id} send personal chat `);
      findUserImg( [ sender ] ).then ( () => {
        sendToMember( receiver.id, sendData( JSON.stringify(convertedData), io, socket, 'invite_to_personal_chat' ) );
        insertPersonalMessage(convertedData);
      }).catch( err => log.d(`err ${err}`))
    });

    socket.on('invite_group_chat', (data, ack) => {
      log.d(`${socket.info.id} send groupchat invite `);
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
      log.d(`${socket.info.id} send_group_message `);
      const convertedData = JSON.parse(data);
      const message = convertedData.message;
      const chatRoom = convertedData.chat_room;
      redis.SMEMBERS(message.chatId).then( members => {
        sendToMembers( message.creatorId, members, sendData( data, io, socket, 'send_group_message' ) );
        insertMessage(messageFieldsCreator( convertedData.message ))
      });
    });
    socket.on('someone_leave_chat_room', data => {
      /*
      data {
        chatRoom: 
        user:
      }
      if chatType == 1 
        db에서 채팅 지우기
          chat_room 지우기
          chat_member 지우기
        else
          redis chat에서 멤버 지우기 
          db에서 
       */
      const json = JSON.parse(data);
      const chatRoom = json.chatRoom;
      const userId = json.userId;

      log.d(`${userId} leave chatroom // chatId ${chatRoom.chatId} // chatType ${chatRoom.chatType}`)
      if ( chatRoom.chatType == 1 ) {
        leavePersonalChatRoom(chatRoom.chatId)
        .then( log.d(`success chatType 1`))
        .catch( err => log.d(`err ${err}`))
      } else {
        leaveGroupChatRoom(chatRoom.chatId, userId)
        .then(redis.SMEMBERS(chatRoom.chatId)
        .then( members => {
          sendToMembers( userId, members, sendData( JSON.stringify({ chatId: chatRoom.chatId, userId: userId }), io, socket, 'someone_leave_chat_room' ) );
        }))
        .then( () => log.d(`success`))
        //TODO 메세지를 데이터베이스에 저장할것
        .catch( err => log.d(`err ${err}`))
      }
    })
    socket.on('chat_read', (data) => {
      const mData = JSON.parse(data);
      const chatId = mData.chat_id;
      const chatType = mData.chatType;
      const messageIdList = mData.messages;
      const sender = mData.sender;
      log.d(`${sender} chat_read `);
      if ( chatType == 1 ) {
        log.d(`chatType 1`);
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
      console.log(sender)
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
        return selectUser('name', {id : sender })
      })
      .then( rs =>{
        users.map( user => insertMessage(systemMessageCreator(chatId, `${rs[0].name}님이 ${user.name}님을 초대했습니다.`)))
      });
      addChatMember(users, chatRoom);
    })

    socket.on('add_friend', id =>{
      log.d(`add_friend`)
      insert('friends', { user_id : socket.info.id, friend_id: id } )
      .then( result => log.d( `add friend result ${result}`))
    })
    socket.on('delete_friend', id => {
      del('friends',  { user_id : socket.info.id, friend_id: id } )
      .then( result => log.d( `del friend result ${result}`))
    })

    socket.on('file_upload_start', data =>{

    })
    socket.on('file_upload', data => {

    })
    socket.on('file_upload_end', data => {

    })
    socket.on('if_login', data => {
      const id = socket.info.id;
      getAllUsers(id).then( results => {
        let list = []; 
        results.map( users => list.push(...users));
        return Promise.all(list.map( user => profileImageRead(user)))
      })
      .then( results => {
        results.map( user => socket.emit('send_initial_state', JSON.stringify({ event: 'user', payload: user })));
        return getMyChatRoomsId(id, 'chat_id')
      })
      .then( chatIds => {
        // console.log(chatIds)
        return getMyChatRoom( chatIds.map( id => id.chat_id), ['chat_id', 'chat_type', 'chat_name'] )
      })
      .then( chatRooms => {
        // console.log(chatRooms)
        chatRooms.map( chatRoom => socket.emit('send_initial_state', JSON.stringify({ event: 'chatRoom', payload: chatRoom[0] })))
        return getMyMessages(id);
      })
      .then( messages => {
        // console.log(messages)
        messages.map( message => socket.emit('send_initial_state', JSON.stringify({ event: 'message', payload: message })))
        return getMyChatMembers(id)
      })
      .then( members => {
        // console.log(members)
        members.map( member => socket.emit('send_initial_state', JSON.stringify({ event: 'chat_members', payload: member })))
      })
      .then( () => {
        socket.emit('send_initial_state', JSON.stringify( { event: 'end', payload: true }))
      })
      .catch( err => console.log(err))
    })
    socket.on('send_event_and_message', (data) => {
      log.d('send_event_and_message')
      emitMyMessages( socket )
      .then(emitMyEvents(socket))
      .then( () => log.d(`send success`))
      .catch ( err => log.d(err) )
    })
    socket.on('send_notification_data', key => {
      log.d(`send_notification_data`)
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
        log.d(result)
      })
    })
    socket.on('change_new_profile_image', data => {
      const id = socket.info.id;
        fs.writeFile(`public/images/profile/${id}/128x128.png`, data, () => {
          const query1 = knex.select('user_id').from('chat_members').whereIn('chat_id', function() {
              this.select('chat_id').from('chat_members').where({ user_id: id });
          }).groupBy('user_id').andWhereNot( { user_id: id } );
          const query2 = knex.select('friend_id as user_id').from('friends').whereNotIn('friend_id', query1).andWhere({ user_id: id})
          Promise.all([ query1, query2])
          .then( result =>  result.flatMap(item => item.map(test => test.user_id)))
          .then( rs => {
            console.log(rs);
            const event = "friend_change_new_profile_image";
            sendToMembers(id, rs, sendData( JSON.stringify({ event, id }), io, socket, event ))
          })
          .catch( err => console.log(err))
        })
    })
    socket.on('get_profile_img', id => {
      log.d(`get_profile_img`)
      fs.readFile(`public/images/profile/${id}/128x128.png`, ( err, data ) => {
        const stringData = new Buffer(data, 'binary').toString('base64');
        socket.emit('get_profile_img', JSON.stringify({ id, data: stringData }));
      })
    })
    socket.on('disconnect', () => {
      redis.hdel('socket_list', socket.info.id);
      log.d(`disconnect ${socket.info.name}`);
    });
  });
  return io;
};


const sendToMember = ( receiver, sendToUser ) => {
  log.d(`method : sendToMember // send to ${receiver}`);
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
  .catch( err => log.d( err ) )
  
}

const sendToMembers = ( sender, members, sendToUser ) => {
  for ( const member of members ) {
    if ( sender !== member ) {
      log.d(`method : sendToMembers // send to ${member}`);
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
      .catch ( err => log.d(err) )
    }
  }
}
// 채팅이 아니면 ( ex. 친구추가 ) 이벤트에 저장하고 채팅이면 messages에 저장한다.
const sendData = ( data, io, socket, emitParam ) => {
    return ( userId, socketId ) => {
        if ( io.sockets.connected[socketId] ) {
          log.d(`userId ${userId} is connected `)
          log.d(`send emit param ${emitParam}`)
          io.sockets.connected[socketId].emit(emitParam, data);
        } else {
          if ( emitParam  === 'invite_group_chat' || emitParam === 'send_group_message' || emitParam === 'invite_to_personal_chat' ) {
            log.d(`userId ${userId} not connected `)
            const key = generateSha1(Date.now('milli').toString());
            storeNotificationToRedis(userId, key, data)
            .then( rows => getFireBaseToken(userId))
            .then( token => {
              log.d(`${userId} token : ${token}`)
              const message = dataMessage(token, { key });
              return sendNotification(message);
            })
            .then(() => {
              console.log('notification success');
            })
            .catch( err => log.d(`err ${err}`));
          } else {
            storeEventToRedis(userId, data)
            .then( result => log.d(result))
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
  .catch ( err => log.d(err) )
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

const createSocketResultData = (result, message_id, chat_id) => ({
  result,
  message_id,
  chat_id,
});
export default createSocket;
