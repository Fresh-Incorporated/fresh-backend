'use strict'

module.exports = async function (fastify, opts) {
    fastify.addHook('onRequest', async (request, reply) => {
        try {
            const accessToken = request.cookies.access_token
            if (!accessToken) {
                return reply.status(401).send({error: 'Missing access token'})
            }

            request.user = fastify.jwt.verify(accessToken)
        } catch (err) {
            reply.status(401).send({error: 'Unauthorized'})
        }
    })

    fastify.get('/', async function (request, reply) {
        const User = fastify.sequelize.model('User');
        const user = await User.findOne({
            where: {
                id: request.user.id
            },
            attributes: {exclude: ['updatedAt']},
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
            attributes: {exclude: ['updatedAt']},
        })

        if (!user) {
            return reply.status(400).send({
                message: "Пользователь не найден.."
            });
        }

        const shops = await Shop.findAll({
            where: {
                ownerId: request.user.id
            },
            include: [{
                model: Product,
                as: 'products',
                attributes: {exclude: ['updatedAt']},
                include: [{
                    model: LocationCell,
                    as: 'refillCell',
                    include: [{
                        model: Location,
                        as: 'location',
                    }]
                }]
            }],
            attributes: {exclude: ['updatedAt']},
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
        try {
            // Получение пользователя
            const user = await User.findOne({
                where: { id: request.user.id },
                attributes: { exclude: ['updatedAt'] },
            });

            if (!user) {
                return reply.status(400).send({ message: "Пользователь не найден." });
            }

            // Получение заказов
            const orders = await Order.findAll({
                where: { customerId: request.user.id },
                include: [
                    {
                        model: LocationCell,
                        as: 'branchCell',
                        attributes: { exclude: ['updatedAt', 'createdAt'] },
                    },
                    {
                        model: Location,
                        as: 'branch',
                        attributes: { exclude: ['updatedAt', 'createdAt'] },
                    },
                    {
                        model: OrderHistory,
                        as: 'history',
                        attributes: { exclude: ['updatedAt'] },
                        include: {
                            model: User,
                            as: "user"
                        }
                    }
                ],
                attributes: { exclude: ['updatedAt'] },
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
}
