'use strict'

const {Op} = require("sequelize");
module.exports = async function (fastify, opts) {
    fastify.addHook('onRequest', async (request, reply) => {
        const User = fastify.sequelize.model('User');

        try {
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

            if (request.user.fm_worker < 1) {
                return reply.status(403).send({
                    message: "Недостаточно прав."
                });
            }
        } catch (err) {
            reply.status(401).send({ error: 'Unauthorized' });
        }
    });

    fastify.get('/list/orders', async function (request, reply) {
        const User = fastify.sequelize.model('User');
        const Shop = fastify.sequelize.model('Shop');
        const Product = fastify.sequelize.model('Product');
        const Location = fastify.sequelize.model('Location');
        const LocationCell = fastify.sequelize.model('LocationCell');
        const Order = fastify.sequelize.model('Order');
        const OrderHistory = fastify.sequelize.model('OrderHistory');
        const LocationCoordinate = fastify.sequelize.model('LocationCoordinate');

        const orders = await Order.findAll({
            where: {
                status: {
                    [Op.or]: [2, 3]
                }
            },
            include: [
                {
                    model: User,
                    as: "currentWorker"
                },
                {
                    model: LocationCell,
                    as: "deliverCell",
                    include: [
                        {
                            model: Location,
                            as: 'location'
                        }
                    ]
                },
                {
                    model: LocationCell,
                    as: "branchCell",
                    include: [
                        {
                            model: Location,
                            as: 'location',
                            include: {
                                model: LocationCoordinate,
                                as: 'coordinates'
                            }
                        }
                    ]
                }
            ]
        });

        const productIds = new Set()
        for (const order of orders) {
            for (const product of order.data?.products) {
                productIds.add(product.id)
            }
        }

        const products = await Product.findAll({
            where: { id: Array.from(productIds) }, // Преобразуем Set в массив
            include: [{
                model: Shop,
                as: "shop",
                attributes: ['id', 'name', 'description', 'icon'],
            },{
                model: LocationCell,
                as: "cell",
            }],
            paranoid: false
        });

        return reply.status(200).send({orders, products});
    });
};
