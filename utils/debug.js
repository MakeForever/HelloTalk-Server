import * as fs from 'fs';
import * as path from 'path';
import Debug from 'debug';
import moment from 'moment'
const stream = fs.createWriteStream(path.join(__dirname, '../', 'test.text'), { flags: 'a', defaultEncoding: 'utf8'})

class Debugger {
  constructor(param) {
    this.debug = Debug(param);
    this.stream = stream;
  }
  d = ( text ) => {
    const time = moment().format("YYYY-MM-DD HH:mm:ss");
    this.debug(`${time} || ${text}`);
    stream.write(`${time} ${text}`)
    stream.write('\n')
  }
};

const createNewOject = (param) => {
  return new Debugger(param);
}
export default createNewOject;