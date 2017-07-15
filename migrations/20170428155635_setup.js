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
      }),
      knex.schema.withSchema('chat_server').createTable('chat_room', function(table) {
        table.string("chat_id").primary()
        table.string("chat_name")
        table.string("chat_type")
        table.timestamps()
      }),
      knex.schema.withSchema('chat_server').createTable('message', function(table) {
        table.increments();
        table.string("chat_id")
        table.string("message_id")
        table.string('creator_id')
        table.string('message_content')
        table.integer('message_type')
        table.integer('read_count')
        table.timestamp('created_time')
      }),
      knex.schema.withSchema('chat_server').createTable('chat_members', function(table) {
        table.increments()
        table.string('chat_id')
        table.string('user_id')
        table.timestamps()
      }),
      knex.schema.withSchema('chat_server').createTable('friends', function(table) {
        table.increments()
        table.string('user_id')
        table.string('friend_id')
        table.timestamps()
      }),
      knex.schema.withSchema('chat_server').createTable('chat_read', function( table ) {
        table.increments().primary()
        table.string('user_id')
        table.string('message_id')
        table.string('chat_id')
        table.timestamp('read_time')
      })
  ])
};

exports.down = function(knex, Promise) {
  return Promise.all([
    knex.schema.dropTable('users'),
    knex.schema.dropTable('message'),
    knex.schema.dropTable('chat_room'),
    knex.schema.dropTable('chat_members')
  ])
};