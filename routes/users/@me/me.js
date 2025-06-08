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
        const spwApi = new SPWorlds({ id: process.env.SPW_ID, token: process.env.SPW_TOKEN })
        const pong = await spwApi.ping()

        if (!pong) {
            return reply.status(500).send({ message: 'SPWorlds API не доступен. Попробуйте позже.' });
        }

        const {receiver} = request.body;
        const amount = parseInt(request.body.amount);

        if (amount == null || amount < 1 || amount > 1728) {
            return reply.status(500).send({ message: 'Сумма должна быть больше 0 и меньше 1729.' });
        }

        const user = await User.findOne({
            where: {
                id: request.user.id
            },
            attributes: ["id", "balance"]
        })

        if (!user) {
            return reply.status(400).send({
                message: "Пользователь не найден."
            });
        }

        if (parseInt(user.balance) < amount) {
            return reply.status(400).send({
                message: "Недостаточно средств."
            });
        }

        await spwApi.createTransaction({
            receiver: receiver,
            amount: amount,
            comment: 'Вывод средств Fresh Inc'
        })

        await User.decrement({balance: amount}, {
            where: {
                id: request.user.id
            }
        })

        await BalanceHistory.create({
            action_type: "withdraw",
            message: "Вывод средств на карту SPWorlds: " + receiver,
            userId: user.id,
            value: -amount
        })

        return reply.status(200).send({ message: "Успешный вывод!"});
    })
}
