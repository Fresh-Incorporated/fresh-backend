'use strict'

const fp = require('fastify-plugin')

module.exports = fp(async function (fastify, opts) {
    fastify.register(require('@fastify/multipart'), {
        attachFieldsToBody: true,
        limits: {
            fileSize: 10 * 1024 * 1024
        }
    })
})
