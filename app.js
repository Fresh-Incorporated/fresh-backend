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
    options: Object.assign({}, opts)
  })

  await database.setupDatabase(fastify)
}

module.exports.options = options
