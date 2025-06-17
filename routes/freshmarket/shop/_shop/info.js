'use strict'

const { uploadToS3 } = require("../../../../utils/s3Util");
const { Op, fn, col, literal } = require('sequelize');
const fns = require('date-fns'); // { format, subDays, isSameDay, parseISO }

module.exports = async function (fastify, opts) {


    fastify.addHook('onRequest', async (request, reply) => {
        try {
            const { User } = fastify.sequelize.models;
            const accessToken = request.cookies.access_token;
            if (!accessToken) {
                return reply.status(401).send({ error: 'Missing access token' });
            }

            request.user = fastify.jwt.verify(accessToken);

            request.user = await User.findOne({
                where: {
                    id: request.user.id
                },
                attributes: { exclude: ['updatedAt'] },
            });

            if (!request.user) {
                return reply.status(400).send({
                    message: "Пользователь не найден."
                });
            }
        } catch (err) {
            reply.status(401).send({ error: 'Unauthorized' });
        }
    });

    fastify.get('/', async function (request, reply) {
        const { Shop, Product, User, LocationCell, ShopCoOwner } = fastify.sequelize.models;

        const shop = await Shop.findOne({
            where: { id: request.params.shop, ownerId: request.user.id },
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

        if (!shop) {
            return reply.status(400).send({
                message: "Магазин не существует или у вас недостаточно прав."
            });
        }

        return reply.send({ shop });
    });

    fastify.get('/sells', async function (request, reply) {
        const { User, Shop, Product, Order } = fastify.sequelize.models;

        const shop = await Shop.findOne({
            where: { id: request.params.shop, ownerId: request.user.id },
            attributes: ['id'],
            include: [{ model: Product, as: 'products', attributes: ['id'] }]
        });

        if (!shop) {
            return reply.status(400).send({
                message: "Магазин не существует или у вас недостаточно прав."
            });
        }

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
                    const product = shop.products.find(prod => prod.id === p.id);
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
