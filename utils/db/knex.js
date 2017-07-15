import knex from 'knex';

const db = knex({
  client: 'mysql2',
  connection: {
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'chat_server',
    dateStrings: 'DATETIME'
  },
});

// db.on( 'query', function( queryData ) {
//     console.log( queryData );
// });

export default db;
