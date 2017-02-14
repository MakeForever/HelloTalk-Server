import { encrypt, decrypt } from './crypto';


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
            name, id , password, gender ,
            isQualified : 0
        }
    return validation;
}
export const checkAuthUrl = ( original, text ) => {

}
export const createAuthUrl = ( original ) => {
    return encrypt(original);
}
export const getSuccess = ( res ) => ( rs ) => res.json( rs );
export const getFail = ( res ) => ( err ) => res.status( 500 ).json( err );

export default { getSuccess, getFail, validateRegistration , createAuthUrl, checkAuthUrl }