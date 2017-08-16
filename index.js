
import http from 'http';
import path from 'path';
import express from 'express';
import bodyParser from 'body-parser';
import indexRouter from './routes/index';
import testRouter from './routes/test';
import loginio from './utils/socket';
import debug from './utils/debug';
const app = express();
const server = http.Server(app);
const port = process.env.PORT || 8888;
const log = debug('index');

Array.prototype.flatMap = function(lambda) { 
  return Array.prototype.concat.apply([], this.map(lambda)); 
};

// parse application/json
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/images', express.static(path.join(__dirname,'public','images','static')));
app.use('/api/', indexRouter);
app.use('/', testRouter);

export const io = loginio(server);

server.listen(port, () => {
  log.d(`server start ${port}`)
});

export default server;
