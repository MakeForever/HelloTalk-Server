import knex from './knex'
import {
    Hashing,
    createToken
} from '../crypto';
import redis from './redis'
import debug from 'debug';
import fs from 'fs';
const dubuger = debug('router/db');


export const selectUser = (selectField, whereFields) => {
    return knex.select(selectField).from('users').where(whereFields);
}
export const getCount = (cloumn, from, whereFields ) => {
    return knex.count(cloumn).from(from).where(whereFields);
}

export const insert = (fields, table) => {
    return knex.insert(fields).into(table)
};
export const updateCertified = (whereQuery, updateQuery) => {
    return knex('users').update(updateQuery).where(whereQuery);
};
export const updateFirstLogin = (updateQuery, whereQuery) => {
    return knex('users').update(updateQuery).where(whereQuery);
};
export const updateMessage = ( updateQuery, whereQuery ) => {
    
};

export const insertChatMembers = ( fields, table ) => {
    return knex.insert(fie)
}
export const insertChatRoom = ( fields, table ) => {

}
//FIXME: db는 쿼리만 리턴하면 된다 그 이외에 로직은 index로 빼자
export const subscribeUser = (success, fail, fields) => {
    knex.from('Users').where('id', fields.id)
        // .then((rows) => {
        //     if (rows.length) {
        //         throw new Error('id already exists');
        //     }
        //     success(fields);
        // })
        // .catch((err) => {
        //     dubuger(err.message);
        //     fail({
        //         message: err.message
        //     });
        // })
        // table.string("chat_id")
        // table.string("message_id")
        // table.string('creator_id')
        // table.string('message_content')
        // table.integer('message_type')
        // table.string("chat_type")
}
export const messageFieldsCreator = ( data ) => {
    return {
        chat_id: data.chat_id,
        message_id: data.message_id,
        creator_id: data.creator_id,
        message_content: data.message_content,
        message_type: data.message_type,
        read_count: data.is_read
    }
}
export const chatRoomfieldsCreator = ( data ) => {
    return {
        chat_id: data.chat_id,
        chat_type: data.chat_type
    }
}
export const chatMemebersFieldsCreator = ( members, chatId ) => {
    let result = [];
    for( let member of members ) {
        result.push({user_id:member.user_id, chat_id:chatId});
    }
    return result;
}
export const insertMessage = ( fields ) => {
    const message = messageFieldsCreator(fields.message);
    insert(message, 'message')
    .then( (result) => {
        getCount('chat_id as count','chat_room', { chat_id:fields.chat_room.chat_id }).then( rs => {
            if( rs[0].count < 1 ) {
                Promise.all([
                    insert(chatRoomfieldsCreator(fields.chat_room), 'chat_room'),
                    insert(chatMemebersFieldsCreator(fields.members, fields.chat_id),'chat_members')
                    ])
            } 
        })
    })
    .catch( err => {
        console.log(err);
    })
}
export const checkLogin = (userId, hashedPassword, success, fail) => {
    selectUser('*', {
            id: userId
        })
        .then((result) => {
            if (!result || !result[0]) { // not found!
                throw new Error('this email not registed!');
            } else if (!result[0].certified) {
                throw new Error('your are not Certified. check your email!');
            } else if (hashedPassword !== result[0].password) {
                throw new Error('password not collect!');
            }
            dubuger( `user ${userId} just attmpt to login ${result[0].name}`);
            const token = createToken({
                id: userId,
                name: result[0].name
            });
            const loginCount = result[0].first_login;
            redis.hset('token_list', userId, token);
            let userInfo = {
                message: 'login complete!',
                token: token,
                login: loginCount,
                name: result[0].name
            };
            if (!loginCount) {
                updateFirstLogin({ first_login: 1 }, { id: userId } ).then((value) => {
                    console.log(value);
                }).catch((err) => {
                    console.log(err);
                });
                userInfo.img = null;
                return userInfo;
            } else {
                return new Promise((resolve, reject) => {
                    const directory = `public/images/profile/${userId}`
                    const fileName = `128x128`
                    const extension = `png`
                    fs.readFile(`${directory}/${fileName}.${extension}`, (err, data) => {
                        if (err) {
                            userInfo.img = null;
                        } else {
                            userInfo.img = new Buffer(data, 'binary').toString('base64');
                        }
                        resolve(userInfo);
                    })
                });
            }
        }).then((userInfo) => {
            success(userInfo);
        })
        .catch((err) => {
            dubuger(`err message ${err} `);
            fail({
                message: err.message
            });
        })
}

export default {
    insert,
    subscribeUser,
    updateCertified,
    selectUser,
    checkLogin,
    insertMessage,
    messageFieldsCreator
}