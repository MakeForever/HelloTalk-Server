import assert from 'assert';
import { getMyUsers, getMyMessages, getMyChatRooms, getAllUsers } from '../utils/db/db';
import { findUserImg, profileImageRead } from '../utils/index';
import redis from '../utils/db/redis';
describe('Array', () => {
  describe('#indexOf()', () => {
    it('should return -1 when the value is not present',() => {
      redis.hvals("test1@naver.com-messages").then( result => console.log(result.reverse()))
    });
  });
});