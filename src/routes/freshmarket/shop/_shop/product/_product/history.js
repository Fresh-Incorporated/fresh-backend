'use strict'

module.exports = async function (fastify, opts) {
    fastify.get('/history', {
        preHandler: [
            fastify.requireProductAccess
        ]
    }, async function (request, reply) {
        const User = fastify.sequelize.model('User');
        const ProductHistory = fastify.sequelize.model('ProductHistory');

        const history = await ProductHistory.findAll({
            where: {
                productId: request.product.id
            },
            attributes: ["id", "action_type", "userId", "productId", "data", "message", "createdAt"],
            include: [
                {
                    model: User,
                    as: "user",
                    attributes: ["id", "nickname", "uuid", "discordId"],
                }
            ],
            limit: 100,
        });

        return reply.status(200).send(history);
    });
};
