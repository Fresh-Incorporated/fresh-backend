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
                max: 10
            }
        }
    }, async function (request, reply) {
        const spwApi = new SPWorlds({ id: process.env.SPW_ID, token: process.env.SPW_TOKEN })
        const pong = await spwApi.ping()

        if (!pong) {
            return reply.status(500).send({ message: 'SPWorlds API не доступен. Попробуйте позже.' });
        }

        const payment = await spwApi.initPayment({
            items: [
                {
                    name: "Пополнение баланса",
                    count: "1",
                    price: request.query.value,
                    comment: "Эти АРы можно вывести обратно без комиссии!"
                }
            ],
            redirectUrl: process.env.FRONTEND_URL + "/bank/payment/spworlds/completed",
            webhookUrl: process.env.BACKEND_URL + "/bank/spworlds/payment",
            data: 'deposit_' + request.user.id
        })

        return reply.status(200).send(payment);
    })
}
