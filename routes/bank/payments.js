'use strict'

module.exports = async function (fastify, opts) {
    fastify.post('/spworlds/payment', async (request, reply) => {
        console.log(request.body)
    })
}
