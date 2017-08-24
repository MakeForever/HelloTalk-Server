import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import Debug from 'debug';
import jade from 'jade';
import juice from 'juice';

import { encrypt, decrypt, Hashing, generateSha1 } from './crypto';
import { selectUser, updateCertified } from './db/db';
import config from '../config';
import fileConfig from '../file_config';
const moment = require('moment');
const debug = Debug('db/index');

const validateEmail = (email) => {
  const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
};
export const validateRegistration = ({ name, id, password, gender }) => {
  const validation = { result: true };
  if (!name) {
    validation.result = false;
    validation.message = 'user name required';
  }
  if (!password) {
    validation.result = false;
    validation.message = 'user password required';
  }
  if (!id) {
    validation.result = false;
    validation.message = 'user id required';
  }
  if (!validateEmail(id)) {
    validation.result = false;
    validation.message = 'worng email address';
  }
  if (gender === undefined) {
    validation.result = false;
    validation.message = 'user gender required';
  }
  if (validation.result) {
    validation.fields = {
      name,
      id,
      password: Hashing(password),
      gender,
      certified: 0,
    };
  }
  return validation;
};
export const checkAuthUrl = (cryptogram, success, fail, test) => {
  const email = decrypt(cryptogram);
  selectUser('*', { id: email })
    .then((rs) => {
      if (!rs || !rs[0]) {
        throw new Error('worng url address!');
      }
      if (rs[0].certified) {
        throw new Error('already Certified');
      }
      updateCertified({ id: email }, { certified: 1 })
          .then(() => {
            const fn = jade.compileFile( __dirname + '/../views/auth_result.jade');
            const html = fn();
            test(html);
          });
    })

    .catch((err) => {
      fail(err.message);
    });
};

export const getProfileImage = ( userId ) => {
  return new Promise( resolve => {
        const directory = `public/images/profile/${userId}`;
        const fileName = '128x128';
        const extension = 'png';
        fs.readFile(`${directory}/${fileName}.${extension}`, (err, data) => {
          if (err) {
            resolve(null);  
          } else {
            const img = new Buffer(data, 'binary').toString('base64')
            resolve(img);  
          }
        });
  });
}

export const authEmailTemplete = data => {
  const fn = jade.compileFile( __dirname + '/../views/email.jade');
  const test = fn(data);
  const html = juice(test);
  return html;
}
export const createAuthUrl = original => encrypt(original);

export const authorization = (token) => {
  const data = jwt.verify(token, config.secret);
  return data;
};

export const getSuccess = res => rs => res.json(rs);
export const getFail = res => err => res.status(500).json(err);

export const findUserImg = ( users ) => {
  let list = [];
  for ( let user of users) {
    list.push( getProfileImage(user.id).then( img => { 
      if( img ){
        user.img = img;
        user.hasProfileImg = true;
      }
      else 
        user.hasProfileImg = false;
      })
      .catch( err => debug(` err ${err}`))
    );
  }
  return Promise.all(list);
};
export const systemMessageCreator = ( chatId , message ) => {
  const time = new Date().getTime();
  const chat_id = chatId;
  const message_id = generateSha1(time.toString());
  const created_time = moment().format('YYYY-MM-DD HH:mm:ss');
  const creator_id = 'system';
  const message_type = 1;
  const read_count = 0;
  const message_content = message;
  return {
    chat_id , message_id, created_time, creator_id, message_type, read_count, message_content
  }
}
export const profileImageRead = user => new Promise((resolve) => {
  const resize = fileConfig.resize;
  const filePath = path.join(__dirname, '..', 'public', 'images', 'profile', `${user.id}`, `${resize}x${resize}.png`);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      user.img = null;
      user.hasProfileImg = false;
      resolve(user);
    } else {
      user.img = new Buffer(data, 'binary').toString('base64');
      user.hasProfileImg = true;
    }
    resolve(user);
  });
});
export default {
  getSuccess,
  getFail,
  validateRegistration,
  createAuthUrl,
  checkAuthUrl,
  authorization,
  getProfileImage,
  findUserImg,
  profileImageRead
};
