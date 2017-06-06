

import express from 'express';
import { insert, subscribeUser, updateCertified, checkLogin } from '../utils/db/db';
import { authEmailTemplete, getSuccess, getFail, validateRegistration , createAuthUrl,
     checkAuthUrl, authorization  } from '../utils/index';
import { transporter, createMailOptions } from '../utils/nodemailerConfig';
import { Hashing } from '../utils/crypto';
import debug from 'debug';
import { io } from "../index";
import jade from 'jade';

import multer from 'multer';
import redis from '../utils/db/redis';
import sharp from 'sharp';
import fileConfig from '../file_config';
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const upload = multer( { dest: 'uploads/' } );
const router = express.Router();
const dubuger = debug('router');


//TODO: 나중에 성공 실패 페이지를 만들것 getSuccess, getFail을 view를 보여주는 함수로 바꾸어야 한다.
router.get('/auth', ( req, res, next ) => {
    checkAuthUrl(req.query.code, getSuccess(res), getFail(res), (rs) => res.send(rs) ) ;
})
router.post('/upload/photo', upload.single('image'), ( req, res, next ) => {

    const token = req.headers.authorization;
    const user  = authorization(token);
    redis.hget('token_list', user.id).then( ( value ) => {
        // console.log(`id :${id} : val ${value} : token ${token}`)
        if( value !== token ) {
            throw new Error;
        }
        const file = req.file;
        if( !file )
            throw new Error('file is empty');
        return file;
        }).then( (file) => {
        const promise  = (path) => {
            return new Promise( (resolve, reject) => {
                fs.stat(path, (err, stats) => {
                    if(err) reject(path);
                    resolve(path);    
                });
            });
        };
    
        const filePath = `public/images/profile/${user.id}`;
        return promise(filePath);
    }).catch( path => {
        fs.mkdirAsync(path);
        return path;
    })
    .then( path => {
        return new Promise ( (resolve, reject) => {
            const filename = 'default.png';
            fs.rename(req.file.path, `${path}/${filename}`, ( err ) => {
                if(err) reject(err);
                resolve({path, name: filename});
            })
        }) 
    })
    .then( img => {
        console.log(img);
        const resize = parseInt(fileConfig.resize);
        sharp(`${img.path}/${img.name}`)
        .resize(resize, resize)
        .toFile(`${img.path}/${resize}x${resize}.png`, (err, info) => {
            if(err) console.log(err);
            console.log(info);
        });
    }).then( () => { 
        res.send('image upload complete');
    }).catch( err => {
        res.status(500).send(err);
    });
});
router.post('/login', ( req, res, next ) => {
    dubuger(`POST /api/login  || id: ${req.body.id} password : ${req.body.password} ` );
    const id = req.body.id;
    const hashedPassword = Hashing(req.body.password);
    checkLogin(id, hashedPassword, getSuccess(res), getFail(res));
})

//회원가입
router.post('/user', ( req, res, next ) => {
    dubuger(`POST /api/user` );
    const validation = validateRegistration(req.body);
    dubuger(`validation result : ${validation.result} : message ${validation.message}`);
    const fields = validation.fields;
    if(!validation.result){
        res.json( 500, validation.message );
    }
    else {
         subscribeUser( (rs) => {
         insert(rs, 'users')
         .then( (result) => {
                
                transporter.sendMail(createMailOptions({...rs, address: createAuthUrl(rs.id)}, authEmailTemplete(createAuthUrl(rs.id))), (err, info) => {
                    if (err) {
                        return console.log(err);
                    }
                    console.log('Message %s sent: %s', info.messageId, info.response);
                    });
                res.json({ message : 'register success' }); 
              
         })
         }, getFail(res), fields);
    }
});

router.delete('/user', ( req, res , next ) => {
    
})
router.put('/user', ( req, res, next ) => {

})

export default router;