//
exports.up = function(knex, Promise) {
  return Promise.all([
      knex.schema.withSchema('chat_server').createTable('users', function(table) {
        table.string("id").primary()
        table.string("password")
        table.string("name")
        table.timestamp('UpdateTimestamp')
        table.timestamp('InsertTimestamp').defaultTo(knex.fn.now())
        table.boolean('first_login').defaultTo(false)
        table.boolean('gender')
        table.boolean('certified').defaultTo(false)
        table.boolean('has_pic').defaultTo(false)
      })
  ])
};

exports.down = function(knex, Promise) {
  return Promise.all([
    knex.schema.dropTable('users')
  ])
};
