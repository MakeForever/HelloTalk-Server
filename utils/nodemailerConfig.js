
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'AppChatGood@gmail.com',
    pass: 'smlemfdl12#',
  },
});

const createMailOptions = (info, content) => ({
  from: '"Fred Foo 👻" <AppChatGood@gmail.com>', // sender address
  to: `${info.id}`, // list of receivers
  subject: 'Hello ✔', // Subject line
  text: 'Hello world ?', // plain text body
  html: content,
});

export { transporter, createMailOptions };
