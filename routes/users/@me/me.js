'use strict'

const {SPWorlds} = require("spworlds");
module.exports = async function (fastify, opts) {
    fastify.addHook('onRequest', async (request, reply) => {
        try {
            const accessToken = request.cookies.access_token
            if (!accessToken) {
                return reply.status(401).send({ error: 'Missing access token' })
            }

            request.user = fastify.jwt.verify(accessToken)
        } catch (err) {
            reply.status(401).send({ error: 'Unauthorized' })
        }
    })

    fastify.get('/deposit', {
        config: {
            rateLimit: {
                timeWindow: '5 minute',
                max: 5
            }
        }
    }, async function (request, reply) {
        const spwApi = new SPWorlds({ id: process.env.SPW_ID, token: process.env.SPW_TOKEN })
        const pong = await spwApi.ping()

        if (!pong) {
            return reply.status(500).send({ message: 'SPWorlds API не доступен. Попробуйте позже.' });
        }

        const value = parseInt(request.query.value);

        if (value == null || value < 1 || value > 1728) {
            return reply.status(400).send({ message: 'Неверное значение.' });
        }

        const payment = await spwApi.initPayment({
            items: [
                {
                    name: "Пополнение баланса",
                    count: "1",
                    price: request.query.value,
                    comment: "Fresh Incorporated",
                }
            ],
            redirectUrl: process.env.FRONTEND_URL + "/bank/payment/spworlds/completed",
            webhookUrl: process.env.BACKEND_URL + "/bank/spworlds/payment",
            data: 'deposit_' + request.user.id
        })

        return reply.status(200).send(payment);
    })

    fastify.post('/withdraw', {
        config: {
            rateLimit: {
                timeWindow: '5 minute',
                max: 5
            }
        }
    }, async function (request, reply) {
        const User = fastify.sequelize.model('User');
        const BalanceHistory = fastify.sequelize.model('BalanceHistory');
        const spwApi = new SPWorlds({ id: process.env.SPW_ID, token: process.env.SPW_TOKEN });

        const pong = await spwApi.ping();
        if (!pong) {
            return reply.status(500).send({ message: 'SPWorlds API не доступен. Попробуйте позже.' });
        }

        const { receiver } = request.body;
        const amount = parseInt(request.body.amount);

        if (!amount || amount < 1 || amount > 1728) {
            return reply.status(400).send({ message: 'Сумма должна быть больше 0 и меньше 1729.' });
        }

        try {
            await fastify.sequelize.transaction(async (t) => {
                const user = await User.findOne({
                    where: { id: request.user.id },
                    attributes: ['id', 'balance'],
                    lock: t.LOCK.UPDATE,
                    transaction: t
                });

                if (!user) {
                    throw new Error("Пользователь не найден.");
                }

                if (parseInt(user.balance) < amount) {
                    throw new Error("Недостаточно средств.");
                }

                await User.update(
                    { balance: user.balance - amount },
                    { where: { id: user.id }, transaction: t }
                );

                await BalanceHistory.create({
                    action_type: "withdraw",
                    message: "Вывод средств на карту SPWorlds: " + receiver,
                    userId: user.id,
                    value: -amount
                }, { transaction: t });

                const response = await spwApi.createTransaction({
                    receiver: receiver,
                    amount: amount,
                    comment: 'Вывод средств Fresh Inc'
                });

                if (!response || response.error) {
                    throw new Error("Ошибка при создании транзакции в SPWorlds.");
                }
            });

            return reply.status(200).send({ message: "Успешный вывод!" });

        } catch (err) {
            const message = ["Недостаточно средств.", "Пользователь не найден."].includes(err.message)
                ? err.message
                : "Ошибка при выводе средств. Попробуйте позже.";

            return reply.status(400).send({ message });
        }
    });
}
