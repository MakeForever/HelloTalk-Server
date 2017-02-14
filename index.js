
'use strict'

import express from 'express';
import bodyParser from 'body-parser';
import indexRouter from'./routes/index';

const app = express();

app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())
app.use('/api/', indexRouter);

app.listen(8080);

export default app;