'use strict'

const {Op} = require("sequelize");
module.exports = async function (fastify, opts) {
    fastify.get('/products', async function (request, reply) {
        const Product = fastify.sequelize.model('Product');
        const Shop = fastify.sequelize.model('Shop');
        const Tag = fastify.sequelize.model('Tag');
        const query = request.query;

        const offset = request.query.offset || 0;

        let defaultQuery = {
            offset: offset,
            limit: 30,
            where: {
                verify_status: 1,
                count: {
                    [Op.gt]: 0
                },
                [Op.and]: [],
                enabled: true,
                cellId: { [Op.not]: null }
            },
            include: [{
                model: Shop,
                as: 'shop',
                attributes: ["id", "name", "icon", "tag"],
                where: {
                    verify_status: 1,
                    enabled: true
                },
            },{
                model: Tag,
                as: 'tags',
                through: { attributes: [] }
            }],
            order: [],
            attributes: ['id', 'name', 'description', 'icon', 'stack_count', 'slots_count', 'price', 'count', 'shopId'],
        }

        if (query.sort !== undefined) {
            switch (query.sort) {
                case 'cheap':
                    defaultQuery.order.push(['price', 'ASC']);
                    break;
                case 'expensive':
                    defaultQuery.order.push(['price', 'DESC']);
                    break;
            }
        }

        if (query.search !== undefined) {
            defaultQuery.where[Op.and].push({
                [Op.or]: [
                    { name: { [Op.iLike]: `%${query.search}%` } },
                    { description: { [Op.iLike]: `%${query.search}%` } },
                    { '$shop.name$': { [Op.iLike]: `%${query.search}%` } },
                ],
            });
        }

        if (query.seed !== undefined) {
            defaultQuery.order.push([fastify.sequelize.literal(`MD5(CONCAT(\"Product\".\"id\", '${query.seed}'))`), 'ASC']);
        }

        const products = await Product.findAll(defaultQuery)

        return reply.status(200).send(products);
    })
}
