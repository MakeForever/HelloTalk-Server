import express from 'express'
import { insert, subscribeUser, updateCertified, checkLogin, update, getMyMessages, selectUser } from '../utils/db/db'
import {
	authEmailTemplete,
	getSuccess,
	getFail,
	validateRegistration,
	createAuthUrl,
	checkAuthUrl,
	authorization
} from '../utils/index'
import {
	transporter,
	createMailOptions
} from '../utils/nodemailerConfig'
import {
	Hashing
} from '../utils/crypto'
import Debug from 'debug'
import {
	io
} from '../index'
import jade from 'jade'
import jwt from 'jsonwebtoken'
import config from '../config'
import multer from 'multer'
import redis from '../utils/db/redis'
import sharp from 'sharp'
import fileConfig from '../file_config'
const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs'))
const upload = multer({
	dest: 'uploads/'
})
const router = express.Router()
const debug = Debug('router')


//TODO: 나중에 성공 실패 페이지를 만들것 getSuccess, getFail을 view를 보여주는 함수로 바꾸어야 한다.
router.get('/auth', (req, res, next) => {
	checkAuthUrl(req.query.code, getSuccess(res), getFail(res), (rs) => res.send(rs))
})
router.post('/upload/photo', upload.single('image'), (req, res, next) => {
	debug(' post /upload/photo')
	const token = req.headers.authorization
	const user = authorization(token)
	redis.hget('token_list', user.id).then(value => {
			// console.log(`id :${id} : val ${value} : token ${token}`)
			debug('stage 1')
			if (value !== token) {
				debug('stage 2')
				throw new Error
			}
			const file = req.file
			if (!file) {
				debug('file is empty')
				throw new Error('file is empty')
			}
			return file
		}).then( file => {
			debug('stage 3')
			const promise = (path) => {
				return new Promise((resolve, reject) => {
					fs.stat(path, (err, stats) => {
						if (err) reject(path)
						resolve(path)
					})
				})
			}
			const filePath = `public/images/profile/${user.id}`
			return promise(filePath)
		}).catch(path => {
			debug('err')
			fs.mkdirAsync(path)
			return path
		})
		.then(path => {
			debug('stage 4')
			return new Promise((resolve, reject) => {
				const filename = 'default.png'
				fs.rename(req.file.path, `${path}/${filename}`, (err) => {
					if (err) reject(err)
					resolve({
						path,
						name: filename
					})
				})
			})
		})
		.then(img => {
			debug('stage 5')
			const resize = parseInt(fileConfig.resize)
			sharp(`${img.path}/${img.name}`)
				.resize(resize, resize)
				.toFile(`${img.path}/${resize}x${resize}.png`, (err, info) => {
					if (err) console.log(err)
					console.log(info)
				})
		})
		.then(() => {
			debug('stage 6')
			res.send('image upload complete')
		})
		.then(() => update('users', {
			has_pic: 1
		}, {
			id: user.id
		}))
		.catch(err => {
			debug('err 2')
			res.status(500).send(err)
		})
})
router.post('/login', (req, res, next) => {
	debug(`POST /api/login  || id: ${req.body.id} password : ${req.body.password} `)
	const id = req.body.id
	const hashedPassword = Hashing(req.body.password)
	checkLogin(id, hashedPassword, getSuccess(res), getFail(res))
})
router.post('/logout', (req, res, next) => {
	const token = req.body.token
	jwt.verify(token, config.secret, (err, decoded) => {
		if (err) {
			debug('token inviled')
			res.send(500)
		}
		const id = decoded.id
		debug(`${ id } is logout`)
		redis.hdel('token_list', id)
		redis.hdel('fire_base_token_list', id)
		res.send(200)
	})
})
router.post('get_all_my_data', (req, res, next) => {
	const token = req.headers.authorization
	const user = authorization(token)

})

//회원가입
router.post('/user', (req, res, next) => {
	debug('POST /api/user')
	const validation = validateRegistration(req.body)
	debug(`validation result : ${validation.result} : message ${validation.message}`)
	const fields = validation.fields
	if (!validation.result) {
		res.json(500, validation.message)
	} else {
		subscribeUser(rs => {
			insert('users', rs)
				.then(result => {
					const data = { ...rs
					}
					debug(console.log(data))
					const html = authEmailTemplete({
						name: data.name,
						address: createAuthUrl(data.id)
					})

					transporter.sendMail(createMailOptions(data, html), (err, info) => {
						if (err) {
							return console.log(err)
						}
						console.log('Message %s sent: %s', info.messageId, info.response)
					})
					res.json({
						message: 'register success'
					})

				})
		}, getFail(res), fields)
	}
})
router.post('/change_password', ( req, res, next ) => {
	const token = req.headers.token;
	const id = req.body.id;
	const currentPassword = req.body.currentPassword;
	const newPassword = req.body.newPassword;
	jwt.verify(token, config.secret, (err, decoded) => {
		if (err) {
			debug('token inviled')
			// res.status(500).send( { message : 'token inviled'} );
			throw new Error('token inviled');
		} else { 
			if ( decoded.id === id ) {
				debug(`token is valied`)
				selectUser('password', { id : id })
				.then ( rs => {
					if ( rs[0].password == Hashing(currentPassword) ) {
						debug(`password is collect`)
						return update('users', { password : Hashing(newPassword) }, { id: id })
					} else {
						throw new Error(`현재 비밀번호가 맞지 않습니다.`)
					}
				})
				.then( rs => {
					console.log(`complete ${rs}`)
				})
				.catch ( err => {
					debug(`err ${err.message}`)
					res.status(500).send( { message : err.message } );
				})
			} else {
				res.status(500).send( { message : `token invalid` } );
			}
		}
	})
	
})
//db test 나중에 지울것
router.get('/test', (req, res, next) => {

})
router.delete('/user', (req, res, next) => {

})
router.put('/user', (req, res, next) => {

})

export default router