'use strict'

const {Op} = require("sequelize");
const {startOfDay, subDays, format} = require("date-fns");
module.exports = async function (fastify, opts) {
    fastify.get('/', { preHandler: fastify.requireAuth }, async function (request, reply) {
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
