import { encrypt, decrypt, Hashing } from './crypto';
import { selectUser, updateCertified } from './db';

export const validateRegistration  = ( { name, id, password, gender } ) => {
    const validation = { result: true };

    if(!name) {
        validation.result = false;
        validation.message = 'user name required';
    }
    if(!password) {
        validation.result = false;
        validation.message = 'user password required';
    }
    if(!id) {
        validation.result = false;
        validation.message = 'user id required';
    }
    if(!gender) {
        validation.result = false;
        validation.message = 'user gender required';
    }
    if(validation.result)
        validation.fields = {
            name, id , password: Hashing(password), gender ,
            Certified : 0
        }
    return validation;
}
export const checkAuthUrl = ( cryptogram, success, fail ) => {
    const email = decrypt(cryptogram);
    selectUser({ id: email })
    .then(( rs ) => {
        if( !rs || !rs[0] ) {
            throw new Error('worng url address!');
        }
        if(rs[0].Certified) {
            throw new Error('already Certified');
        }
        updateCertified({ id: email }, { Certified: 1 })
          .then( (result) => {
            success('you are now Certified');
          })
    })

    .catch(( err ) => {
        fail(err.message);
    })
}
export const createAuthUrl = ( original ) => {
    return encrypt(original);
}
export const getSuccess = ( res ) => ( rs ) => res.json( rs );
export const getFail = ( res ) => ( err ) => res.status( 500 ).json( err );

export default { getSuccess, getFail, validateRegistration , createAuthUrl, checkAuthUrl }