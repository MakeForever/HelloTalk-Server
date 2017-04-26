import knex from './knex'
import { Hashing, createToken } from '../crypto';
import redis from './redis'
import debug from 'debug';
const dubuger = debug('router/db');


export const selectUser = (selectField, whereFields) => {
    return knex.select(selectField).from('users').where(whereFields);
}


export const insert = ( fields, table ) =>
{
  return knex.insert( fields ).into( table )
};
export const updateCertified = ( whereQuery, updateQuery ) => {
    return knex('users').update(updateQuery).where(whereQuery);
};
export const updateFirstLogin = ( updateQuery, whereQuery ) => {
    return knex('users').update(updateQuery).where(whereQuery);
};

//FIXME: db는 쿼리만 리턴하면 된다 그 이외에 로직은 index로 빼자
export const subscribeUser = (success, fail, fields) => {
    knex.from('Users').where('id', fields.id)
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

export const checkLogin = ( userId, hashedPassword, success, fail ) => {
    selectUser('*', { id: userId })
    .then(( result ) => {
        if (!result || !result[0])  {  // not found!
            throw new Error('this email not registed!');
        }
        else if( !result[0].certified ) {
            throw new Error('your are not Certified. check your email!');
        }
        else if( hashedPassword !== result[0].password ){
            throw new Error('password not collect!');
        }
        const token = createToken({ id: userId, name: result[0].name });
        const loginCount = result[0].first_login;
        redis.hset('idList', userId, token);
        if(!loginCount) {
            updateFirstLogin( { first_login : 1 }, { id:userId} ).then( (value) => {
                console.log(value);
            }).catch( (err) => {
                console.log(err);
            }); 
        }
        success({ message: 'login complete!' , token: token, login: loginCount ,name : result[0].name});     
    })
    .catch( (err) => {
        dubuger(`err message ${err} `);
        fail({ message : err.message });
    })
}

export default { insert, subscribeUser, updateCertified , selectUser, checkLogin }