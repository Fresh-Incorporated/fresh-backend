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

    fastify.post('/', async function (request, reply) {
        const User = fastify.sequelize.model('User');
        const user = await User.findOne({
            where: {
                id: request.user.id
            },
            attributes: {exclude: ['updatedAt']},
        })

        if (!user) {
            return reply.status(400).send({
                message: "Пользователь не найден.."
            });
        }

        return reply.status(200).send(user);
    })
}
