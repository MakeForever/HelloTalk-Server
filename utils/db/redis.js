import promise_redis from 'promise-redis';


const promiseFactory = require("when").promise;
const redisClient = promise_redis(promiseFactory).createClient(); 

redisClient.on("error", function (err) {
    console.log("Error " + err);
})

export default redisClient;
