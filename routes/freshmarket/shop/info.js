'use strict'

const {Op} = require("sequelize");
module.exports = async function (fastify, opts) {
    fastify.get('/info', async function (request, reply) {
        const Product = fastify.sequelize.model('Product');
        const Shop = fastify.sequelize.model('Shop');
        const User = fastify.sequelize.model('User');
        const query = request.query;

        const shop = await Shop.findOne({
            where: {
                tag: query.tag,
                enabled: true
            },
            attributes: ["id", "name", "description", "tag", "icon", "verify_status", "ownerId"],
            include: [
                {
                    model: Product,
                    as: 'products',
                    where: {
                        verify_status: 1,
                        enabled: true
                    },
                    attributes: ["id", "name", "description", "icon", "stack_count", "slots_count", "price", "count"],
                },
                {
                    model: User,
                    as: 'owner',
                    attributes: ["id", "nickname", "uuid"]
                }
            ]
        })

        return reply.status(200).send(shop);
    })
}
