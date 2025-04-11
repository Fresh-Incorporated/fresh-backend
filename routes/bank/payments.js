'use strict'

const {SPWorlds} = require("spworlds");

module.exports = async function (fastify, opts) {
    fastify.post('/spworlds/payment', async (request, reply) => {
        const User = fastify.sequelize.model('User');

        const spwApi = new SPWorlds({ id: process.env.SPW_ID, token: process.env.SPW_TOKEN })
        const isValid = spwApi.validateHash(request.body, request.headers['X-Body-Hash'])

        if (!isValid) {
            return reply.status(400).send({ message: 'Ошибка проверки цифровой подписи.' });
        }

        const {data, amount} = request.body;

        await User.increment({balance: amount}, {
            where: {
                id: data.id
            }
        });

        console.log("OK!")
    })
}
