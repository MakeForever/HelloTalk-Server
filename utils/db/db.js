import fs from 'fs';
import Debug from 'debug';
import knex from './knex';
import {
  createToken
} from '../crypto';
import redis, { deleteChatRoomUserRedis } from './redis';
import { getProfileImage, findUserImg, findUserImg2 } from '../index';
const debug = Debug('router/db');
export const getCount = (cloumn, as, from, whereFields) => knex.count(`${cloumn} as ${as}`).from(from).where(whereFields).then(rs => rs[0][as]);
export const selectUser = (selectField, whereFields) => knex.select(selectField).from('users').where(whereFields);
export const select = ( selectField, whereFields, table ) => knex.select(selectField).from(table).where(whereFields);
export const insert = ( table, fields ) => knex.insert(fields).into(table);
export const count = (field, table , where ) => knex.count(field).from(table).where(where);
export const del = ( table, whereFields ) => knex(table).where(whereFields).del()
export const update = ( table, fields, whereFields ) => knex(table).update(fields).where(whereFields);
export const updateCertified = (whereQuery, updateQuery) => knex('users').update(updateQuery).where(whereQuery);
export const updateFirstLogin = (updateQuery, whereQuery) => knex('users').update(updateQuery).where(whereQuery);
export const subscribeUser = (success, fail, fields) => {
    knex.from('users').where('id', fields.id)
    .then( (rows) => {
        if(rows.length){
            throw new Error('id already exists');
        }
        success(fields);
    })
    .catch((err) => {
        debug(err.message);
        fail({message: err.message});
    })
}
export const messageFieldsCreator = data => ({
  chat_id: data.chatId,
  message_id: data.messageId,
  creator_id: data.creatorId,
  message_content: data.messageContent,
  message_type: data.messageType,
  created_time: data.createdTime,
  read_count: data.readCount,
});
export const readMessage = ( data ) => {
  const messages = data.messages;
  for ( const message of messages ) {
    select('read_count', { message_id : message }, 'message').then( result => {
      const count = result[0].read_count;
      if ( count > 0 ) {
        update( 'message', { read_count: (count - 1) }, { message_id : message } )
        .then( result => debug(`message update row ${result}`))
        .then( () => insert('chat_read', { user_id: data.sender, message_id : message, chat_id: data.chat_id }) )
        .then( result => debug(`chat read row ${result} inserted`))
      }
    });
  }
}
export const addChatMember = ( users, chatRoom ) => {
  for( const user of users ) {
    count('* as count', 'chat_members', { chat_id:chatRoom.chatId, user_id: user.id})
    .then( rs => {
      if ( rs[0].count ) {
        return update('chat_members', {is_member : 1}, { chat_id : chatRoom.chatId, user_id: user.id } )
      } else {
        return insert( 'chat_members', { chat_id : chatRoom.chatId, user_id: user.id } )
      }
    })
    .then( result => debug(result))
  }
}
export const chatRoomfieldsCreator = data => ({
  chat_id: data.chatId,
  chat_type: data.chatRoomType
});
export const chatMemebersFieldsCreator = (members, chatId) => {
  const result = [];
  members.forEach(member => result.push({
    user_id: member.id,
    chat_id: chatId
  }));
  return result;
};
export const insertMessage = ( message ) => {
  console.log(message)
  insert ( 'message', message ).then ( () => debug(`message inserted`)).catch ( err => console.log(err))
}
export const insertPersonalMessage = (fields) => {
  const message = messageFieldsCreator(fields.message);
  const chatRoom = fields.chatRoom;
  insert( 'message', message )
  .then( () => getCount('chat_id', 'count', 'chat_room', { chat_id: chatRoom.chatId }) )
  .then( count => {
    if ( !count ) {
      return insert( 'chat_room', chatRoomfieldsCreator(chatRoom))
    }
  })
  .then(() => getCount('user_id', 'count', 'chat_members', { chat_id: chatRoom.chatId, user_id: chatRoom.talkTo.id }))
  .then( count => {
    if ( !count ) {
      return insert( 'chat_members', chatMemebersFieldsCreator( [ chatRoom.talkTo ], chatRoom.chatId) )
    }
  })
  .then(() => getCount('user_id', 'count', 'chat_members', { chat_id: chatRoom.chatId, user_id: fields.receiver.id }))
  .then( count  => {
    if ( !count ) {
      return insert( 'chat_members', chatMemebersFieldsCreator( [ fields.receiver ], chatRoom.chatId ))
    }
  })
  .then( () => debug(`insert compliete`))
  .catch((err) => {
    console.log(err);
  });
};

export const deleteChatRoom = chatId => {
  return knex.from('chat_room').where({ chat_id: chatId}).del();
}
export const deleteAllChatRoomMembers = ( chatId ) => {
  return knex.from('chat_members').where( { chat_id: chatId } ).del();
}
export const deleteChatRoomMemberByUserId = ( chatId, userId ) => {
  return knex.from('chat_members').where( { chat_id: chatId, user_id: userId }).del();
}
export const deleteMessages = ( chatId ) => {
  return knex.from('message').where( { chat_id: chatId } ).del();
} 
export const getNumberOfmember = chatId => {
  return knex.count('* as count').from('chat_members').where( { chat_id: chatId } )
}
export const leaveGroupChatRoom = ( chatId, userId ) => {
  return knex.count('* as count').from('message').where({ chat_id: chatId, creator_id: userId})
  .then( rs => {
    if ( rs[0].count > 0 ) {
      return knex('chat_members').update({is_member : 0 }).where({ chat_id: chatId, user_id: userId })
      .then(deleteChatRoomUserRedis(chatId, userId))``
    } else {
      return getNumberOfmember(chatId)
      .then( data => {
        const count = data[0].count;
        if ( count == 1 ) {
          deleteChatRoomMemberByUserId(chatId, userId)
          .then(deleteChatRoom(chatId))
          .then(deleteMessages(chatId))
          .then(deleteChatRoomUserRedis(chatId, userId))
          .then( debug (`count ${count} so all deleted`))
        } else {
          deleteChatRoomMemberByUserId(chatId, userId)
          .then(deleteChatRoomUserRedis(chatId, userId))
          .then(debug(`count ${count} `))
        }
      })
    }
  })
}
export const leavePersonalChatRoom = ( chatId ) => {
  return deleteChatRoom(chatId)
  .then(() => deleteAllChatRoomMembers(chatId))
}
export const checkLogin = (userId, hashedPassword, success, fail) => {
  redis.hexists('token_list', userId)
  .then( rs => {
    if ( !rs ) {
      return selectUser('*', { id: userId })
    } else {
      throw new Error('이미 다른 디바이스에 로그인 되어 있습니다.');
    }
  })
  .then( result => {
    if (!result || !result[0]) { // not found!
      throw new Error('등록되지 않은 아이디 입니다!');
    } else if (!result[0].certified) {
        throw new Error('이메일 인증이 되어 있지 않습니다');
    } else if (hashedPassword !== result[0].password) {
      throw new Error('비밀번호가 맞지 않습니다!');
    }
    debug(`user ${userId} just attmpt to login ${result[0].name}`);
    const token = createToken( { id: userId, name: result[0].name } );
    const loginCount = result[0].first_login;
    const hasPic = result[0].has_pic;
    const name = result[0].name;
    const message = 'login success!';
    redis.hset('token_list', userId, token);
    return getProfileImage(userId).then( img => {
        return createLoginMessage(message, token, loginCount, name, img );
      })
  })
  .then( userInfo => {
    success(userInfo);
    return userInfo.login;
  })
  .then( loginCount => {
    if ( !loginCount ) {
      return updateFirstLogin( { first_login: 1 }, { id: userId } );
    }
  })
  .catch((err) => {
    debug(`err message ${err} `);
    fail( { message: err.message } );
  });  
};


const createLoginMessage = ( message, token, loginCount, name, img ) => {
  return {
    message,
    token,
    login: loginCount,
    name,
    img
  }
}
export const createChatRoom = ( data ) => {
  const chatRoom = data.chatRoom;
  const chatId = chatRoom.chatId;
  const chatName = chatRoom.chatName;
  const chatType = chatRoom.chatRoomType;
  const users = chatRoom.users;

  insert('chat_room', { chat_id: chatId, chat_type: chatType, chat_name: chatName } )
  .then( () => {
    debug(`chatId ${chatId} inserted`);
  })
  for( const user of users ) {
    insert('chat_members', { chat_id: chatId, user_id: user.id } ).then( result => debug(`chatID ${chatId} member ${user.id}`));
  }
}
export const getMyFriends = ( id ) => {
  return knex.select(knex.raw('id, name, true AS ?', 'is_my_friend')).from('users').whereIn('id', select(`friend_id`, { user_id : id }, `friends`));
}
export const getMyUsers = ( id ) => {
  const chatMembersSubquery = getMyChatRoomsId(id, 'chat_id');
  const sub2 = knex.select('friend_id').from('friends').where( { user_id: id } )
  const sub1 = knex.select('user_id').from('chat_members').where('user_id','not in', sub2)
                        .andWhere('chat_id', 'in', chatMembersSubquery )
                        .andWhereNot( { user_id: id } ).groupBy('user_id')
  return knex.select(knex.raw('id, name, false AS ?', 'is_my_friend')).from('users').where('id', 'in', sub1);
}
export const getAllUsers = ( id ) => {
  const myUsers = getMyUsers(id);
  const myFriends = getMyFriends(id);
  return Promise.all([myUsers, myFriends])
}
export const getMyChatRoomsId = ( id, selectField ) => {
  return knex.select(selectField).from('chat_members').where( { user_id: id } ).andWhere({is_member : 1 })
}
export const getMyChatRoom = ( ids, selectFields ) => {
  return Promise.all(ids.map( id => knex.select(selectFields).from('chat_room').where( { chat_id: id } )));
}
export const findMyChatMembers = ( chatId, userId) => {
  return knex.select('user_id').from('chat_members').where({ chat_id: chatId}).andWhereNot({ user_id: userId }).then( rs => rs.map( user => user.user_id))
}
// export const getMyMessages = ( id ) => {
//   const subQuery1 = knex.select('*').from('chat_read').where({ user_id: id }).as('rd');
//   const subQuery2 = knex.select('created_at').from('chat_members').whereRaw('chat_id = ms.chat_id').andWhere( { user_id: id } )
//   return knex.select('ms.*', 'rd.read_time').from('message as ms').leftOuterJoin(subQuery1, function() {
//           this.on('ms.message_id', '=', 'rd.message_id').andOn('ms.chat_id', '=', 'rd.chat_id')
//           }).where('ms.chat_id', 'in', getMyChatRoomsId(id, 'chat_id')).andWhere('ms.created_time', '>=', subQuery2).orderBy('id', 'asc');
// }
export const getMyMessages = ( id ) => { 
  const subQuery1 = knex.select('*').from('chat_read').where({ user_id: id }).as('rd'); 
  const subQuery2 = knex.select('invited_time').from('chat_invite').where( { user_id : id } ) 
  const subQuery3 = knex.select('created_at').from('chat_members').whereRaw('chat_id = ms.chat_id').andWhere( { user_id: id } ) 
  return knex.select('ms.*', 'rd.read_time').from('message as ms').leftOuterJoin(subQuery1, function() { 
          this.on('ms.message_id', '=', 'rd.message_id').andOn('ms.chat_id', '=', 'rd.chat_id') 
          })
          .where('ms.chat_id', 'in', getMyChatRoomsId(id, 'chat_id'))
          .andWhere('ms.created_time', '>=', subQuery3); 
} 
export const getMyChatMembers = ( id ) => {
  return knex.select('chat_id', 'user_id', 'is_member').from('chat_members').where('chat_id', 'in', getMyChatRoomsId(id, 'chat_id')).andWhereNot( { user_id: id });
}

export default {
  insert,
  subscribeUser,
  updateCertified,
  selectUser,
  checkLogin,
  insertPersonalMessage,
  messageFieldsCreator,
  createChatRoom,
  readMessage,
  addChatMember,
  update,
  del,
  getAllUsers,
  getMyChatRoomsId,
  getMyMessages,
  getMyChatMembers,
  getMyChatRoom
};