import db from './knex'

export const insert = ( fields, table ) =>
{
  return db.insert( fields ).into( table )
};

export const registrationUser = (success, fail, fields) => {

    db.from('Users').where('Id', fields.id)
    .then( (rows) => {
        if(rows.length){
            throw new Error('id already exists');
        }
    })
    .then(success(fields))
    .catch((err) => {
        fail(err.message);
    })
    
    
}

export default { insert, registrationUser }