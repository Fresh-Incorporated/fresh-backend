'use strict'

const {Op} = require("sequelize");
module.exports = async function (fastify, opts) {
    fastify.get('/products', async function (request, reply) {
        const offset = request.query.offset || 0;
        const Product = fastify.sequelize.model('Product');
        const Shop = fastify.sequelize.model('Shop');

        const products = await Product.findAll({
            offset,
            limit: 30,
            where: {
                verify_status: 1,
                count: {
                    [Op.gt]: 0
                },
                enabled: true
            },
            include: {
                model: Shop,
                as: 'shop',
                attributes: ["id", "name", "icon"],
                where: {
                    verify_status: 1,
                    enabled: true
                },
            },
            attributes: ['id', 'name', 'description', 'icon', 'stack_count', 'slots_count', 'price', 'count', 'shopId'],
        })

        return reply.status(200).send(products);
    })
}
