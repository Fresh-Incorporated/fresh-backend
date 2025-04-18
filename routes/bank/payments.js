'use strict'

const {SPWorlds} = require("spworlds");

module.exports = async function (fastify, opts) {
    fastify.post('/spworlds/payment', async (request, reply) => {
        const User = fastify.sequelize.model('User');
        const BalanceHistory = fastify.sequelize.model('BalanceHistory');

        const spwApi = new SPWorlds({ id: process.env.SPW_ID, token: process.env.SPW_TOKEN })
        const isValid = spwApi.validateHash(request.body, request.headers['x-body-hash'])

        if (!isValid) {
            return reply.status(400).send({ message: 'Ошибка проверки цифровой подписи.' });
        }

        const {data, amount} = request.body;

        const type = data.split('_')[0]; // For updates [deposit]
        const id = data.split('_')[1];

        await User.increment({balance: amount}, {
            where: {
                id: id
            }
        });

        await BalanceHistory.create({
            action_type: "deposit",
            message: "Пополнение средств из SPWorlds",
            userId: id,
            value: amount
        })
    })
}
