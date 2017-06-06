import promise_redis from 'promise-redis';


const promiseFactory = require("when").promise;
const redis = promise_redis(promiseFactory).createClient(); 

redis.on("error", function (err) {
    console.log("Error " + err);
})
export const addChatToRedis = ( chatName, members ) => {
    redis.sadd('chat_list', chatName);
    redis.sadd(chatName, members);
}
export const getSocketId = ( id ) => {
    return redis.hget('socket_list', id);
}
export default redis;
