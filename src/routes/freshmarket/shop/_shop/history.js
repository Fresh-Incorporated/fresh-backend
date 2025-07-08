'use strict'

module.exports = async function (fastify, opts) {
    fastify.get('/history', {
        preHandler: [
            fastify.requireShopAccess
        ]
    }, async function (request, reply) {
        const User = fastify.sequelize.model('User');
        const ShopHistory = fastify.sequelize.model('ShopHistory');

        const history = await ShopHistory.findAll({
            where: {
                shopId: request.shop.id
            },
            attributes: ["id", "action_type", "userId", "shopId", "data", "message", "createdAt"],
            include: [
                {
                    model: User,
                    as: "user",
                    attributes: ["id", "nickname", "uuid"],
                }
            ],
            limit: 100,
        });

        return reply.status(200).send(history);
    });
};
