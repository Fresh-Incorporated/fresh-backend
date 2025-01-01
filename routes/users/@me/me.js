'use strict'

module.exports = async function (fastify, opts) {
    fastify.addHook('onRequest', async (request, reply) => {
        try {
            const accessToken = request.cookies.access_token
            if (!accessToken) {
                return reply.status(401).send({ error: 'Missing access token' })
            }

            request.user = fastify.jwt.verify(accessToken)
        } catch (err) {
            reply.status(401).send({ error: 'Unauthorized' })
        }
    })

    fastify.post('/delete', async function (request, reply) {
        const User = fastify.sequelize.model('User');
        await User.destroy({
            where: {
                id: request.user.id
            }
        })

        return reply.status(200).send();
    })
}
