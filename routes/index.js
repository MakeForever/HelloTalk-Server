'use strict'

import express from 'express';
import db from '../utils/knex';
import { insert, registrationUser } from '../utils/db';
import { getSuccess, getFail, validateRegistration , createAuthUrl, checkAuthUrl  } from '../utils/index';
import { transporter, createMailOptions } from '../utils/nodemailerConfig';

const router = express.Router();

router.get('/auth', (req,res,next) => {
    const code = req.query.code;
    
})

//회원가입
router.post('/user', (req, res, next) => {
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

export default router;