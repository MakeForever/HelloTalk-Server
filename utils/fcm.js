import FCM from 'fcm-push';
import config from '../config';

const fcm = new FCM(config.fcm_server_key);

export const notificationMessage = (token, title, content) => ({
  to: token,
  notification: {
    title,
    body: content,
  },
});
export const dataMessage = (token, data) => ({
  to: token,
  data,
});

export const sendNotification = message => fcm.send(message);
export default { fcm, dataMessage, notificationMessage, sendNotification };
