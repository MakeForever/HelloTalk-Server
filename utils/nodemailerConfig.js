
import nodemailer from 'nodemailer';
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'AppChatGood@gmail.com',
        pass: 'smlemfdl12#'
    }
});

const createMailOptions = (info) => {
   return {
    from: '"Fred Foo 👻" <AppChatGood@gmail.com>', // sender address
    to: `${info.id}`, // list of receivers
    subject: 'Hello ✔', // Subject line
    text: 'Hello world ?', // plain text body
    html: `<a herf=/api/auth?code=${ info.address }> click here </a>` // html body
    }
};

export {transporter, createMailOptions}