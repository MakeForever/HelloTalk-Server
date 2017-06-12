import promiseredis from 'promise-redis';

const promiseFactory = require('when').promise;

const redis = promiseredis(promiseFactory).createClient();

redis.on('error', (err) => {
  console.log(`Error ${err}`);
});
export const addChatToRedis = (chatName, members) => {
  redis.sadd('chat_list', chatName);
  redis.sadd(chatName, members);
};
export const getSocketId = id => redis.hget('socket_list', id);
export default redis;
