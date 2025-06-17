'use strict'

const {Op} = require("sequelize");
const {startOfDay, subDays, format} = require("date-fns");
module.exports = async function (fastify, opts) {
    fastify.addHook('onRequest', async (request, reply) => {
        try {
            const accessToken = request.cookies.access_token
            if (!accessToken) {
                return reply.status(401).send({message: 'Missing access token'})
            }

            request.user = fastify.jwt.verify(accessToken)
        } catch (err) {
            reply.status(401).send({message: 'Unauthorized'})
        }
    })

    fastify.get('/', async function (request, reply) {
        const User = fastify.sequelize.model('User');

        const { search = '' } = request.query;

        const users = await User.findAll({
            where: {
                nickname: {
                    [Op.iLike]: `%${search}%`
                }
            },
            attributes: ['nickname', 'uuid'],
            limit: 10,
            order: [['nickname', 'ASC']]
        });

        return reply.status(200).send({ users });
    });
}
