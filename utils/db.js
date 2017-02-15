import db from './knex'
import { Hashing } from './crypto';


export const selectUser = (whereFields) => {
    return db.select('*').from('Users').where(whereFields);
}
export const insert = ( fields, table ) =>
{
  return db.insert( fields ).into( table )
};
export const updateCertified = ( whereQuery, updateQuery ) => {
    return db('Users').update(updateQuery).where(whereQuery);
};


//FIXME: db는 쿼리만 리턴하면 된다 그 이외에 로직은 index로 빼자
export const registrationUser = (success, fail, fields) => {
    db.from('Users').where('Id', fields.id)
    .then( (rows) => {
        if(rows.length){
            throw new Error('id already exists');
        }
        success(fields);
    })
    .catch((err) => {
        fail(err.message);
    })
}

export const checkLogin = ( userId, hashedPassword, success, fail ) => {
    selectUser({ id: userId })
    .then(( result ) => {

        if (!result || !result[0])  {  // not found!
            throw new Error('please enter collect email!');
        }
        else if( !result[0].Certified ) {
            throw new Error('your are not Certified. check your email!');
        }
        else if( hashedPassword !== result[0].Password ){
            throw new Error('password not collect!');
        }
        success('login complete!');     
    })
    .catch( (err) => {
        fail(err.message);
    })
}

export default { insert, registrationUser, updateCertified , selectUser, checkLogin }