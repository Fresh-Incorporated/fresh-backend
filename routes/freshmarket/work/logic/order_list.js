'use strict'

const {Op} = require("sequelize");
module.exports = async function (fastify, opts) {
    fastify.addHook('onRequest', async (request, reply) => {
        const User = fastify.sequelize.model('User');
        const Product = fastify.sequelize.model('Product');
        const Location = fastify.sequelize.model('Location');
        const LocationCell = fastify.sequelize.model('LocationCell');

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

            if (request.user.fm_worker < 2) {
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

        const orders = await Order.findAll({
            where: {
                status: {
                    [Op.lte]: 1
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
                }
            ]
        });

        // Сбор уникальных productId из заказов
        const productIds = new Set(); // Используем Set для избежания дубликатов
        const ordersWithProducts = orders.map(order => {
            const orderData = typeof order.data === "object" ? order.data : { products: [] };
            orderData.products.forEach(product => productIds.add(product.id));
            const object = { ...order.toJSON(), products: orderData.products };
            delete object.data;
            return object;
        });

        // Получение продуктов по уникальным productId
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
        });

        return reply.status(200).send({orders: ordersWithProducts, products});
    });
};
