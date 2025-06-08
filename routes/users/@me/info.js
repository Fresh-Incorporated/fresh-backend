'use strict'

module.exports = async function (fastify, opts) {
    fastify.addHook('onRequest', async (request, reply) => {
        try {
            const accessToken = request.cookies.access_token
            if (!accessToken) {
                return reply.status(401).send({message: 'Missing access token'})
            }

            request.user = fastify.jwt.verify(accessToken)
        } catch (err) {
            reply.status(401).send({message: 'Unauthorized'})
        }
    })

    fastify.get('/', async function (request, reply) {
        const User = fastify.sequelize.model('User');
        const user = await User.findOne({
            where: {
                id: request.user.id
            },
            attributes: ['id', 'nickname', 'uuid', 'discordId', 'balance', 'bonuses', 'fm_worker', 'admin', 'createdAt'],
        })

        if (!user) {
            return reply.status(400).send({
                message: "Пользователь не найден.."
            });
        }

        return reply.status(200).send(user);
    })

    fastify.get('/shops', async function (request, reply) {
        const User = fastify.sequelize.model('User');
        const Shop = fastify.sequelize.model('Shop');
        const Product = fastify.sequelize.model('Product');
        const Location = fastify.sequelize.model('Location');
        const LocationCell = fastify.sequelize.model('LocationCell');

        const user = await User.findOne({
            where: {
                id: request.user.id
            },
            attributes: ['id'],
        })

        if (user == null) {
            return reply.status(400).send({
                message: "Пользователь не найден.."
            });
        }

        const shops = await Shop.findAll({
            where: {
                ownerId: request.user.id
            },
            attributes: ['id', 'name', 'description', 'icon', 'products_limit', 'verify_status', 'balance', 'createdAt', 'tag'],
            include: [{
                model: Product,
                as: 'products',
                attributes: ['id', 'name', 'description', 'icon', 'stack_count', 'slots_count', 'price', 'verify_status', 'refill_status', 'count', 'createdAt'],
                include: [{
                    model: LocationCell,
                    as: 'refillCell',
                    attributes: { exclude: ['locationId'] },
                    include: [{
                        model: Location,
                        as: 'location',
                        attributes: { exclude: ['deletedAt', 'updatedAt', 'createdAt'] },
                    }]
                }]
            }],
            order: [['id', 'ASC']]
        });

        return reply.status(200).send(shops);
    })

    fastify.get('/orders', async function (request, reply) {
        const User = fastify.sequelize.model('User');
        const Shop = fastify.sequelize.model('Shop');
        const Product = fastify.sequelize.model('Product');
        const Location = fastify.sequelize.model('Location');
        const LocationCell = fastify.sequelize.model('LocationCell');
        const Order = fastify.sequelize.model('Order');
        const OrderHistory = fastify.sequelize.model('OrderHistory');
        const LocationImage = fastify.sequelize.model('LocationImage');
        const LocationCoordinate = fastify.sequelize.model('LocationCoordinate');

        try {
            // Получение пользователя
            const user = await User.findOne({
                where: { id: request.user.id },
                attributes: ['id'],
            });

            if (!user) {
                return reply.status(400).send({ message: "Пользователь не найден." });
            }

            // Получение заказов
            const orders = await Order.findAll({
                where: { customerId: request.user.id },
                attributes: ['id', 'type', 'world', 'x', 'y', 'z', 'data', 'price', 'status', 'paid', 'createdAt'],
                include: [
                    {
                        model: LocationCell,
                        as: 'branchCell',
                    },
                    {
                        model: Location,
                        as: 'branch',
                        attributes: { exclude: ['deletedAt'] },
                        include: [
                            {
                                model: LocationImage,
                                as: 'images',
                                attributes: { exclude: ['createdAt', 'updatedAt'] },
                            },
                            {
                                model: LocationCoordinate,
                                as: 'coordinates',
                                attributes: { exclude: ['createdAt', 'updatedAt'] },
                            }
                        ]
                    },
                    {
                        model: OrderHistory,
                        as: 'history',
                        attributes: ['id', 'action_type', 'message', 'createdAt'],
                        include: {
                            model: User,
                            as: "user",
                            attributes: ['id', 'nickname', 'discordId', 'uuid']
                        }
                    }
                ],
            });

            // Сбор уникальных productId из заказов
            const productIds = new Set(); // Используем Set для избежания дубликатов
            const ordersWithProducts = orders.map(order => {
                const orderData = typeof order.data === "object" ? order.data : { products: [] };
                orderData.products.forEach(product => productIds.add(product.id));
                return { ...order.toJSON(), products: orderData.products };
            });

            // Получение продуктов по уникальным productId
            const products = await Product.findAll({
                where: { id: Array.from(productIds) }, // Преобразуем Set в массив
                include: {
                    model: Shop,
                    as: "shop",
                    attributes: ['id', 'name', 'description', 'icon'],
                },
                attributes: ['id', 'name', 'description', 'icon', 'price', 'shopId'],
            });

            return reply.status(200).send({ orders: ordersWithProducts, products });
        } catch (error) {
            console.error(error)
            return reply.status(500).send({ message: "Ошибка сервера", error: error.message });
        }
    })

    fastify.get('/history/balance', async function (request, reply) {
        const { offset } = request.query;
        const User = fastify.sequelize.model('User');
        const BalanceHistory = fastify.sequelize.model('BalanceHistory');

        const user = await User.findOne({
            where: {
                id: request.user.id
            },
            attributes: ['id'],
        })

        if (user == null) {
            return reply.status(400).send({
                message: "Пользователь не найден.."
            });
        }

        const history = await BalanceHistory.findAll({
            where: {
                userId: request.user.id
            },
            attributes: ['id', 'action_type', 'message', 'value', 'createdAt'],
            order: [['createdAt', 'DESC']],
            limit: 20,
            offset: offset,
        });

        return reply.status(200).send(history);
    })
}
