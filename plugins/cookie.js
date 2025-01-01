'use strict'

const fp = require('fastify-plugin')

/**
 * This plugins adds some utilities for cookies
 *
 * @see https://github.com/fastify/fastify-cookie
 */
module.exports = fp(async function (fastify, opts) {
  fastify.register(require('@fastify/cookie'), {
    secret: process.env.COOKIE_SECRET, // for cookies signature
    hook: 'onRequest', // set to false to disable cookie autoparsing or set autoparsing on any of the following hooks: 'onRequest', 'preParsing', 'preHandler', 'preValidation'. default: 'onRequest'
    parseOptions: {}  // options for parsing cookies
  })
})
