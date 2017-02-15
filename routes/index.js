'use strict'

import express from 'express';
import db from '../utils/knex';
import { insert, registrationUser, updateCertified, checkLogin } from '../utils/db';
import { getSuccess, getFail, validateRegistration , createAuthUrl, checkAuthUrl  } from '../utils/index';
import { transporter, createMailOptions } from '../utils/nodemailerConfig';
import { Hashing } from '../utils/crypto';
const router = express.Router();

//TODO: 나중에 성공 실패 페이지를 만들것 getSuccess, getFail을 view를 보여주는 함수로 바꾸어야 한다.
router.get('/auth', ( req, res, next ) => {
    checkAuthUrl(req.query.code, getSuccess(res), getFail(res));
})

router.post('/login', ( req, res, next ) => {
    const id = req.body.id;
    const hashedPassword = Hashing(req.body.password);
    checkLogin(id, hashedPassword, getSuccess(res), getFail(res));
})

//회원가입
router.post('/user', ( req, res, next ) => {
    const validation = validateRegistration(req.body);
    const fields = validation.fields;

    if(!validation.result){
        res.send(500, validation.message);
    }
    else {
         registrationUser( (rs) => {
         insert(rs, 'Users')
         .then( (result) => {
            transporter.sendMail(createMailOptions({...rs, address:createAuthUrl(rs.id)}), (err, info) => {
                if (err) {
                    return console.log(err);
                }
                console.log('Message %s sent: %s', info.messageId, info.response);
            });
            
            res.send('register success');

         })
         }, getFail(res), fields);
    }
});

router.delete('/user', ( req, res , next ) => {
    
})
router.put('/user', ( req, res, next ) => {

})
export default router;