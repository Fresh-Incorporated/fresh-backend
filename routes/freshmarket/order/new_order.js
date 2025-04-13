'use strict'

const {Op} = require("sequelize");
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
                attributes: { exclude: ['updatedAt'] },
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

    fastify.post('/new/instant', async function (request, reply) {
        const Product = fastify.sequelize.model('Product');
        const Shop = fastify.sequelize.model('Shop');
        const Order = fastify.sequelize.model('Order');
        const OrderHistory = fastify.sequelize.model('OrderHistory');
        const ShopHistory = fastify.sequelize.model('ShopHistory');
        const Location = fastify.sequelize.model('Location');

        const { type, branch } = request.body;
        const { balance } = request.user;

        const products = request.body.products.map((product) => {
            product.count = parseInt(product?.count);
            return product;
        })

        if (type !== "branch") {
            return reply.status(400).send({ message: "Сейчас доступна доставка только в филиалы!" });
        }

        if (products.length < 1) {
            return reply.status(400).send({ message: "Корзина пуста!" });
        }

        const location = await Location.findOne({
            where: {
                id: branch,
                enabled: true,
                type: "branch"
            }
        })

        if (!location) {
            return reply.status(400).send({ message: "Доставка в выбранный филиал недоступна!" });
        }

        const transaction = await fastify.sequelize.transaction();

        try {
            const productIds = products.map(product => product.id);
            const productRows = await Product.findAll({
                where: { id: productIds },
                include: {
                    model: Shop,
                    as: "shop"
                },
                transaction,
            });

            if (productRows.length !== products.length) {
                return reply.status(400).send({ message: "Некоторые товары не найдены." });
            }

            let totalPrice = 0;

            // Валидация продуктов и расчёт общей суммы
            for (const product of products) {
                const productRow = productRows.find(row => row.id === product.id);

                if (!productRow) {
                    return reply.status(400).send({ message: `Товар с ID ${product.id} не найден.` });
                }

                if (product.count > productRow.count) {
                    return reply.status(400).send({ message: `Товара "${productRow.name}" недостаточно на складе.` });
                }

                if (product.count < 1) {
                    return reply.status(400).send({ message: `Ты как 0 товара заказал гений?` });
                }

                totalPrice += productRow.price * product.count;
            }

            if (balance < totalPrice) {
                return reply.status(400).send({ message: "Недостаточно средств, пополните баланс." });
            }

            // Списываем средства с пользователя и обновляем количество продуктов
            for (const product of products) {
                const productRow = productRows.find(row => row.id === product.id);
                await Shop.increment({balance: productRow.price * product.count * 0.9}, {
                    where: {
                        id: productRow.shopId,
                    }
                }, { transaction });
                await ShopHistory.create({
                    action_type: "ordered",
                    userId: request.user.id, // Тот кто создал заказ
                    shopId: productRow.shopId,
                    data: {
                        product: product.id,
                        count: product.count,
                        price: productRow.price,
                    },
                }, { transaction })
                await productRow.decrement({ count: product.count }, { transaction });
            }

            await request.user.decrement({ balance: totalPrice }, { transaction });

            // Создаём заказ
            const order = await Order.create({
                customerId: request.user.id,
                type,
                price: totalPrice,
                paid: true,
                branchId: branch,
                data: { products: products.map(({ id, count }) => ({ id, count })) },
            }, { transaction });

            await OrderHistory.create({
                action_type: "created",
                orderId: order.id,
                userId: request.user.id
            }, { transaction })

            await OrderHistory.create({
                action_type: "paid",
                orderId: order.id,
                userId: request.user.id
            }, { transaction })

            await transaction.commit();
            return reply.status(200).send({ message: "Заказ оформлен." });

        } catch (error) {
            await transaction.rollback(); // Откатываем транзакцию при ошибке
            return reply.status(500).send({ message: "Произошла ошибка при оформлении заказа.", error: error.message });
        }
    })
}
