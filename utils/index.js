import { encrypt, decrypt, Hashing } from './crypto';
import { selectUser, updateCertified } from './db/db';
import redis from './db/redis';
import jwt from 'jsonwebtoken';
import config from '../config';

const validateEmail = (email)  => {
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
}
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
    if(!validateEmail(id)) {
        validation.result = false;
        validation.message = 'worng email address';
    }
    if(gender === undefined) {
        validation.result = false;
        validation.message = 'user gender required';
    }
    if(validation.result)
        validation.fields = {
            name, id , password: Hashing(password), gender ,
            certified : 0
        }
    return validation;
}
export const checkAuthUrl = ( cryptogram, success, fail, test ) => {
    const email = decrypt(cryptogram);
    selectUser('*',{ id: email })
    .then(( rs ) => {
        if( !rs || !rs[0] ) {
            throw new Error('worng url address!');
        }
        if(rs[0].certified) {
            throw new Error('already Certified');
        }
        updateCertified({ id: email }, { certified: 1 })
          .then( (result) => {
            test('<script>alert("인증되었습니다.")</script>');
          })
    })

    .catch(( err ) => {
        fail(err.message);
    })
}

export const authEmailTemplete = ( address ) => {

    return `<!DOCTYPE html>
    <html lang="ko">
    <head>
        <title></title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons">
        <link rel="stylesheet" href="https://code.getmdl.io/1.3.0/material.light_green-blue.min.css" /> 
        <script defer src="https://code.getmdl.io/1.3.0/material.min.js"></script>
        <style>
            body {
                text-align: center;
                }
        </style>
    </head>
    <body>
        <h1>회원가입을 진심으로 축하합니다!</h1>
        <p>인증을 하실려면 아래의 버튼을 눌러주세요<p>
        <a href="http://127.0.0.1:8080/api/auth?code=${address}">인증</a>
    </body>
    
    </html>`
}
export const createAuthUrl = ( original ) => {
    return encrypt(original);
}

export const authorization = ( token ) => {
    const data = jwt.verify(token, config.secret);
    return data;
}

export const getSuccess = ( res ) => ( rs ) => res.json( rs );
export const getFail = ( res ) => ( err ) => res.status( 500 ).json( err );

export default { getSuccess, getFail, validateRegistration , createAuthUrl, checkAuthUrl, authorization }
