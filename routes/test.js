import express from 'express';
import { dataMessage, sendNotification } from '../utils/fcm'; 
const router = express.Router();

router.get( '/test', ( req, res, next ) => {
    const token = 'cK7WM_Pc20k:APA91bFV87OfHBpMygUtsAlrfOtaj6KMsxm820LDz077-co8HkCfQCJWtL1NN_f604Rrprcky41YtjMQQFTgL1jAoAO7EOGqwsdBHVKatnpHJaL4Ia0h1d5kQgiyMTJdjuwX9rW_si_q';
    const data = dataMessage( token, { hi: 'hello world', chat_type: 1 })
    sendNotification(data).then ( () => {
        console.log(`success`)
    })
});


export default router;