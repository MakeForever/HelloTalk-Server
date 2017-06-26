import fs from 'fs';
import Debug from 'debug';
import knex from './knex';
import {
  createToken
} from '../crypto';
import redis from './redis';
import { getProfileImage, findUserImg, findUserImg2 } from '../index';
const debug = Debug('router/db');
const getCount = (cloumn, from, whereFields) => knex.count(cloumn).from(from).where(whereFields);
export const selectUser = (selectField, whereFields) => knex.select(selectField).from('users').where(whereFields);
export const select = ( selectField, whereFields, table ) => knex.select(selectField).from(table).where(whereFields);
export const insert = ( table, fields ) => knex.insert(fields).into(table);
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
        dubuger(err.message);
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
        .then( result => debug(result))
      }
    });
  }
}
export const addFriend = ( users, chatRoom ) => {
  for( const user of users ) {
    insert( 'chat_members', { chat_id : chatRoom.chatId, user_id: user.id } )
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
export const insertMessage = ( fields ) => {
  const message = messageFieldsCreator( fields.message )
  insert ( 'message', message ).then ( () => debug(`message inserted`)).catch ( err => debug(err))
}
export const insertPersonalMessage = (fields) => {
  const message = messageFieldsCreator(fields.message);
  const chatRoom = fields.chatRoom;
  insert( 'message', message )
    .then(() => {
      debug(`messageId ${message.messageId} inserted`)
      getCount('chat_id as count', 'chat_room', {
        chat_id: chatRoom.chatId
      }).then((rs) => {
        if (rs[0].count < 1) {
          Promise.all([
            insert( 'chat_room', chatRoomfieldsCreator(chatRoom)),
            insert( 'chat_members', chatMemebersFieldsCreator( [ chatRoom.talkTo, fields.receiver ], chatRoom.chatId) ),
          ]);
          debug(`chatId ${ chatRoom.chatId } just inserted`)
        }
      });
    })
    .catch((err) => {
      console.log(err);
    });
};
export const checkLogin = (userId, hashedPassword, success, fail) => {
  selectUser('*', {
      id: userId,
    })
    .then((result) => {
      if (!result || !result[0]) { // not found!
        throw new Error('this email not registed!');
      } else if (!result[0].certified) {
        throw new Error('your are not Certified. check your email!');
      } else if (hashedPassword !== result[0].password) {
        throw new Error('password not collect!');
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
  return knex.select(knex.raw('id, name, true AS ?', 'is_added')).from('users').whereIn('id', select(`friend_id`, { user_id : id }, `friends`));
}
export const getMyUsers = ( id ) => {
  const chatMembersSubquery = getMyChatRoomsId(id, 'chat_id');
  const sub2 = knex.select('friend_id').from('friends').where( { user_id: id } )
  const sub1 = knex.select('user_id').from('chat_members').where('user_id','not in', sub2)
                        .andWhere('chat_id', 'in', chatMembersSubquery )
                        .andWhereNot( { user_id: id } ).groupBy('user_id')
  return knex.select(knex.raw('id, name, false AS ?', 'is_added')).from('users').where('id', 'in', sub1);
}
export const getAllUsers = ( id ) => {
  const myUsers = getMyUsers(id);
  const myFriends = getMyFriends(id);
  return Promise.all([myUsers, myFriends])
}
export const getMyChatRoomsId = ( id, selectField ) => {
  return knex.select(selectField).from('chat_members').where( { user_id: id } )
}
export const getMyChatRoom = ( ids, selectFields ) => {
  return Promise.all(ids.map( id => knex.select(selectFields).from('chat_room').where( { chat_id: id } )));
}
export const getMyMessages = ( id ) => {
  return knex.select('*').from('message').where('chat_id', 'in', getMyChatRoomsId(id, 'chat_id'));
}
export const getMyChatMembers = ( id ) => {
  return knex.select('chat_id', 'user_id').from('chat_members').where('chat_id', 'in', getMyChatRoomsId(id, 'chat_id')).andWhereNot( { user_id: id });
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
  addFriend,
  update,
  del,
  getAllUsers,
  getMyChatRoomsId,
  getMyMessages,
  getMyChatMembers,
  getMyChatRoom
};