
import http from 'http';
import express from 'express';
import bodyParser from 'body-parser';
import indexRouter from './routes/index';
import testRouter from './routes/test';
import loginio from './utils/socket';

const app = express();
const server = http.Server(app);
const port = process.env.PORT || 8888;

// parse application/json
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use('/api/', indexRouter);
app.use('/', testRouter);

export const io = loginio(server);

server.listen(port, () => {
  console.log(`server start ${port}`);
});


export default server;
