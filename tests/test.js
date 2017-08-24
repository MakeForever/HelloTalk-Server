import assert from 'assert';
import { getMyMessages, getMyChatMembers, select, findMyChatMembers, getAllUsers, insertMessage } from '../utils/db/db';
import { findUserImg, profileImageRead, authEmailTemplete, systemMessageCreator } from '../utils/index';
import {deleteChatRoomUser} from '../utils/db/redis';
import knex from '../utils/db/knex';
import { transporter, createMailOptions } from '../utils/nodemailerConfig';
describe('Array', () => {
  describe('#indexOf()', function() {
    it('should return -1 when the value is not present', done => {
      const id = 'b';
      knex.select('*').from('users').where(knex.raw(`match(id) against( '+${id}*' in boolean mode)`))
      .then( rs => {
        console.log(rs);
        done()
      })
    });
  });
});