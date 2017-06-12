import fs from 'fs';
import debug from 'debug';
import knex from './knex';
import {
  createToken
} from '../crypto';
import redis from './redis';
import { getProfileImage } from '../index';
const dubuger = debug('router/db');
const getCount = (cloumn, from, whereFields) => knex.count(cloumn).from(from).where(whereFields);
export const selectUser = (selectField, whereFields) => knex.select(selectField).from('users').where(whereFields);
export const insert = (fields, table) => knex.insert(fields).into(table);
export const updateCertified = (whereQuery, updateQuery) => knex('users').update(updateQuery).where(whereQuery);
export const updateFirstLogin = (updateQuery, whereQuery) => knex('users').update(updateQuery).where(whereQuery);
export const subscribeUser = (success, fail, fields) => knex.from('Users').where('id', fields.id);
export const messageFieldsCreator = data => ({
  chat_id: data.chat_id,
  message_id: data.message_id,
  creator_id: data.creator_id,
  message_content: data.message_content,
  message_type: data.message_type,
  read_count: data.is_read,
});
export const chatRoomfieldsCreator = data => ({
  chat_id: data.chat_id,
  chat_type: data.chat_type,
});
export const chatMemebersFieldsCreator = (members, chatId) => {
  const result = [];
  members.forEach(member => result.push({
    user_id: member.user_id,
    chat_id: chatId
  }));
  return result;
};
export const insertMessage = (fields) => {
  const message = messageFieldsCreator(fields.message);
  insert(message, 'message')
    .then(() => {
      getCount('chat_id as count', 'chat_room', {
        chat_id: fields.chat_room.chat_id
      }).then((rs) => {
        if (rs[0].count < 1) {
          Promise.all([
            insert(chatRoomfieldsCreator(fields.chat_room), 'chat_room'),
            insert(chatMemebersFieldsCreator(fields.members, fields.chat_id), 'chat_members'),
          ]);
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
      dubuger(`user ${userId} just attmpt to login ${result[0].name}`);
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
      dubuger(`err message ${err} `);
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
export default {
  insert,
  subscribeUser,
  updateCertified,
  selectUser,
  checkLogin,
  insertMessage,
  messageFieldsCreator,
};