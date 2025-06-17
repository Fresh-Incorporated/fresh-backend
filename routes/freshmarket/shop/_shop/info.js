'use strict'

const { uploadToS3 } = require("../../../../utils/s3Util");
const { Op, fn, col, literal } = require('sequelize');
const fns = require('date-fns'); // { format, subDays, isSameDay, parseISO }

module.exports = async function (fastify, opts) {

    fastify.get('/', { preHandler: fastify.requireShopAccess }, async function (request, reply) {
        const { Product, User, LocationCell, ShopCoOwner } = fastify.sequelize.models;

        const shop = await request.shop.reload({
            include: [{
                model: Product,
                as: 'products',
                include: [{ model: LocationCell, as: 'refillCell' }]
            },{
                model: ShopCoOwner,
                as: 'co_owners',
                include: [{
                    model: User,
                    as: 'user',
                    attributes: ["id", "uuid", "nickname"]
                }]
            }]
        });

        return reply.send({ shop });
    });

    fastify.get('/sells', { preHandler: fastify.requireShopAccess }, async function (request, reply) {
        const { Product, Order } = fastify.sequelize.models;

        const shop = await request.shop.reload({
            attributes: ['id'],
            include: [{ model: Product, as: 'products', attributes: ['id'] }]
        });

        const productIds = shop.products.map(p => p.id);

        const orders = await Order.findAll({
            where: {
                paid: true,
                data: {
                    [Op.ne]: null
                }
            },
            attributes: ['id', 'data', 'paid', 'createdAt'],
        });

        const salesHistory = {};

        for (const order of orders) {
            const orderProducts = order.data.products || [];

            for (const p of orderProducts) {
                if (!productIds.includes(p.id)) continue;

                if (!salesHistory[p.id]) {
                    salesHistory[p.id] = {
                        productId: p.id,
                        sales: []
                    };
                }

                salesHistory[p.id].sales.push({
                    orderId: parseInt(order.id),
                    count: p.count,
                    price: p.price ?? 0,
                    date: order.createdAt
                });
            }
        }

        reply.send({
            productLastSells: Object.values(salesHistory)
        });
    });
};
