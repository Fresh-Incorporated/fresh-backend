'use strict'

const {SPWorlds} = require("spworlds");

module.exports = async function (fastify, opts) {
    fastify.post('/spworlds/payment', async (request, reply) => {
        const User = fastify.sequelize.model('User');

        const spwApi = new SPWorlds({ id: process.env.SPW_ID, token: process.env.SPW_TOKEN })
        console.log(request.body)
        console.log(request.headers)
        const isValid = spwApi.validateHash(request.body, request.headers['X-Body-Hash'])

        if (!isValid) {
            return reply.status(400).send({ message: 'Ошибка проверки цифровой подписи.' });
        }

        const {data, amount} = request.body;

        console.log(data)
        console.log(amount)

        const type = data.split('_')[0]; // For updates [deposit]
        const id = data.split('_')[1];
        console.log(type)
        console.log(id)

        await User.increment({balance: amount}, {
            where: {
                id: id
            }
        });

        console.log("OK!")
    })
}
