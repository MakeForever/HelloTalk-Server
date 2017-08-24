
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'AppChatGood@gmail.com',
    pass: 'smlemfdl12#',
  },
});

const createMailOptions = (info, content) => ({
  from: '"Hello Talk" <AppChatGood@gmail.com>', // sender address
  to: `${info.id}`, // list of receivers
  subject: `Hello ${info.name}`, // Subject line
  text: 'Welcome my Friend', // plain text body
  html: content,
});

export { transporter, createMailOptions };
