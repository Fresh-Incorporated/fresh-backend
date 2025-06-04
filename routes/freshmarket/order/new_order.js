'use strict'

const {Op} = require("sequelize");
const {SPWorlds} = require("spworlds");
module.exports = async function (fastify, opts) {
    fastify.addHook('onRequest', async (request, reply) => {
        const User = fastify.sequelize.model('User');
        try {
            const accessToken = request.cookies.access_token
            if (!accessToken) {
                return reply.status(401).send({error: 'Missing access token'})
            }

            request.user = fastify.jwt.verify(accessToken)

            request.user = await User.findOne({
                where: {
                    id: request.user.id
                },
                attributes: ['id', 'balance'],
            });

            if (!request.user) {
                return reply.status(400).send({
                    message: "Пользователь не найден."
                });
            }
        } catch (err) {
            reply.status(401).send({error: 'Unauthorized'})
        }
    })

    fastify.post('/new/instant', {
        config: {
            rateLimit: {
                timeWindow: '5 minute',
                max: 5
            }
        }
    }, async function (request, reply) {
        const Product = fastify.sequelize.model('Product');
        const Shop = fastify.sequelize.model('Shop');
        const Order = fastify.sequelize.model('Order');
        const OrderHistory = fastify.sequelize.model('OrderHistory');
        const Location = fastify.sequelize.model('Location');
        const BalanceHistory = fastify.sequelize.model('BalanceHistory');

        const {type, branch} = request.body;
        const {balance} = request.user;

        const products = request.body.products.map((product) => {
            product.count = parseInt(product?.count);
            return product;
        })


        if (type !== "branch") {
            return reply.status(400).send({message: "Сейчас доступна доставка только в филиалы!"});
        }

        if (products.length < 1) {
            return reply.status(400).send({message: "Корзина пуста!"});
        }

        const location = await Location.findOne({
            where: {
                id: branch,
                enabled: true,
                type: "branch"
            },
            attributes: ['id']
        })

        if (location == null) {
            return reply.status(400).send({message: "Доставка в выбранный филиал недоступна!"});
        }
        const productIds = products.map(product => product.id);
        const productRows = await Product.findAll({
            where: {id: productIds, verify_status: 1},
            include: {
                model: Shop,
                as: "shop"
            }
        });

        if (productRows.length !== products.length) {
            return reply.status(400).send({message: "Некоторые товары не найдены."});
        }

        let totalPrice = 0;
        let totalSlots = 0;

        // Валидация продуктов и расчёт общей суммы
        for (const product of products) {
            const productRow = productRows.find(row => row.id === product.id);

            if (!productRow) {
                return reply.status(400).send({message: `Товар с ID ${product.id} не найден.`});
            }

            if (product.count > productRow.count) {
                return reply.status(400).send({message: `Товара "${productRow.name}" недостаточно на складе.`});
            }

            if (product.count < 1) {
                return reply.status(400).send({message: `Ты как 0 товара заказал гений?`});
            }

            totalPrice += productRow.price * product.count;
            totalSlots += productRow.slots_count * product.count;
        }

        if (totalSlots > 27) {
            return reply.status(500).send({message: 'Слишком большой заказ! Мы временно не доставляем более 27 слотов.'});
        }

        if (balance < totalPrice) {
            if (totalPrice < 1728) {
                const spwApi = new SPWorlds({id: process.env.SPW_ID, token: process.env.SPW_TOKEN})
                const pong = await spwApi.ping()

                if (!pong) {
                    return reply.status(500).send({message: 'SPWorlds API не доступен. Попробуйте позже.'});
                }
                const items = []
                for (const product of products) {
                    const productRow = productRows.find(row => row.id === product.id);
                    const item = {
                        name: productRow.name.length > 32 ? productRow.name.slice(0, 29) + '...' : productRow.name,
                        count: product.count,
                        price: productRow.price
                    };

                    if (productRow.description.length >= 3) {
                        item.comment = productRow.description.length > 64
                            ? productRow.description.slice(0, 61) + '...'
                            : productRow.description;
                    }

                    items.push(item);
                }
                const payment = await spwApi.initPayment({
                    items,
                    redirectUrl: process.env.FRONTEND_URL + "/bank/payment/spworlds/completed",
                    webhookUrl: process.env.BACKEND_URL + "/bank/spworlds/payment",
                    data: 'deposit_' + request.user.id
                })
                return reply.status(400).send({message: "Недостаточно средств, пополните баланс.", url: payment.url});
            } else {
                return reply.status(400).send({message: "Недостаточно средств, пополните баланс."});
            }
        }

        const transaction = await fastify.sequelize.transaction();

        try {
            // Списываем средства с пользователя и обновляем количество продуктов
            for (const product of products) {
                const productRow = productRows.find(row => row.id === product.id);
                await Shop.increment({balance: productRow.price * product.count * 0.9}, {
                    where: {
                        id: productRow.shopId,
                    },
                    transaction
                });

                product.price = productRow.price
                await productRow.decrement({count: product.count}, {transaction});
            }

            await request.user.decrement({balance: totalPrice}, {transaction});

            const order = await Order.create({
                customerId: request.user.id,
                type,
                price: totalPrice,
                paid: true,
                branchId: branch,
                data: {products: products.map(({id, count, price}) => ({id, count, price}))},
            }, {transaction});

            await OrderHistory.create({
                action_type: "created",
                orderId: order.id,
                userId: request.user.id
            }, {transaction})

            await OrderHistory.create({
                action_type: "paid",
                orderId: order.id,
                userId: request.user.id
            }, {transaction})

            await BalanceHistory.create({
                action_type: "freshmarket_order",
                message: "Заказ на FreshMarket",
                userId: request.user.id,
                value: -totalPrice,
            }, {transaction})

            await transaction.commit();
            return reply.status(200).send({message: "Заказ оформлен."});

        } catch (error) {
            console.error(error);
            await transaction.rollback(); // Откатываем транзакцию при ошибке
            return reply.status(500).send({message: "Произошла ошибка при оформлении заказа.", error: error.message});
        }
    })
}
