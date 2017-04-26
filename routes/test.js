import express from 'express';

const router = express.Router();

const dumyData = {
    list : [
                {
                    name : "number1",
                    email : "beakya@naver.com1",
                    gender : 1,
                    certified : 0
                },
                {
                    name : "number2",
                    email : "beakya@naver.com2",
                    gender : 1,
                    certified : 0
                },
                {
                    name : "number3",
                    email : "beakya@naver.com3",
                    gender : 1,
                    certified : 0
                },
                {
                    name : "number4",
                    email : "beakya@naver.com4",
                    gender : 1,
                    certified : 0
                },
                {
                    name : "number5",
                    email : "beakya@naver.com5",
                    gender : 1,
                    certified : 0
                },
            ]
};
router.get( '/test', ( req, res, next ) => {
    res.send(dumyData);
});


export default router;