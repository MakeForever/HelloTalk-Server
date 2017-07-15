import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import config from '../config';

const algorithm = 'aes-256-ctr';
const password = 'd6F3Efeqqweasccf13tg34';

export const createToken = (info) => {
  const token = jwt.sign(info, config.secret);
  return token;
};

export const encrypt = (text) => {
  const cipher = crypto.createCipher(algorithm, password);
  let crypted = cipher.update(text, 'utf8', 'hex');
  crypted += cipher.final('hex');
  return crypted;
};

export const decrypt = (text) => {
  const decipher = crypto.createDecipher(algorithm, password);
  let dec = decipher.update(text, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
};

export const Hashing = (text) => {
  const hash = crypto.createHash('sha256');
  hash.update(text);
  return hash.digest('hex');
};
export const generateSha1 = data => {
  const hash = crypto.createHash('sha1');
  hash.update(data);
  return hash.digest('hex'); 
}
export default { encrypt, decrypt, Hashing, createToken, generateSha1 };
