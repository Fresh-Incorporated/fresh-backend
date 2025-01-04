'use strict'

module.exports = async function (fastify, opts) {
    fastify.get('/products', async function (request, reply) {
        const offset = request.query.offset || 0;
        const Product = fastify.sequelize.model('Product');
        const Shop = fastify.sequelize.model('Shop');

        const products = await Product.findAll({
            offset,
            limit: 30,
            include: {
                model: Shop,
                as: 'shop',
                attributes: ["id", "name", "icon"]
            }
        })

        return reply.status(200).send(products);
    })
}
