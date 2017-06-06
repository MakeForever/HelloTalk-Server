import FCM from 'fcm-push';
import config from '../config';
const fcm = new FCM(config.fcm_server_key);

export const notificationMessage = (token, title, content) => {
    return {
        to: token,
        notification: {
            title: title,
            body: content
        }
    }
}
export const dataMessage = ( token, data ) => {
    return {
        to : token,
        data : data
    }
}

export const sendNotification = (message) => {
    return fcm.send(message);
}
export default { fcm, dataMessage, notificationMessage, sendNotification };