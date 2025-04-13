'use strict'

const path = require('node:path')
const AutoLoad = require('@fastify/autoload')
const database = require("./database/database");
const fs = require('fs');

// Pass --options via CLI arguments in command to enable these options.
const options = {}

module.exports = async function (fastify, opts) {
  const dir = './uploads';

  fs.mkdirSync(dir, { recursive: true });

  await fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'plugins'),
    options: Object.assign({}, opts)
  })

  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'routes'),
    routeParams: true,
    options: Object.assign({}, opts)
  })

  fastify.setErrorHandler(function (error, request, reply) {
    if (error.statusCode === 429) {
      return reply.code(429).send({ error: 'Превышен лимит скорости. Попробуйте позже.'})
    }
  })

  await database.setupDatabase(fastify)
}

module.exports.options = options
