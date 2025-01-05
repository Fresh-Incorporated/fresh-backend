'use strict'

module.exports = async function (fastify, opts) {
    fastify.get('/products', async function (request, reply) {
        const offset = request.query.offset || 0;
        const Product = fastify.sequelize.model('Product');
        const Shop = fastify.sequelize.model('Shop');

        const products = await Product.findAll({
            offset,
            limit: 30,
            where: {
                verify_status: 1
            },
            include: {
                model: Shop,
                as: 'shop',
                attributes: ["id", "name", "icon"],
                where: {
                    verify_status: 1
                },
            }
        })

        return reply.status(200).send(products);
    })
}
