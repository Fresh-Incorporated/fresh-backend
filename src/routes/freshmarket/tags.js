'use strict'

const {Op} = require("sequelize");
module.exports = async function (fastify, opts) {
    fastify.get('/tags', async function (request, reply) {
        const Tag = fastify.sequelize.model('Tag');

        const tags = await Tag.findAll()

        return reply.status(200).send(tags);
    })
}
