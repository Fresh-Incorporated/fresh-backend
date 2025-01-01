'use strict'

const fp = require('fastify-plugin')

/**
 * This plugins adds some utilities for cookies
 *
 * @see https://github.com/fastify/fastify-cookie
 */
module.exports = fp(async function (fastify, opts) {
  fastify.register(require('@fastify/jwt'), {
    secret: process.env.JWT_SECRET,
  })
})
