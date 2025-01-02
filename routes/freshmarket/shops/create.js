'use strict'

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

    fastify.post('/create', async function (request, reply) {
        const User = fastify.sequelize.model('User');
        const Shop = fastify.sequelize.model('Shop');

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

        const shops = await Shop.findAll({where: {ownerId: request.user.id}});

        const price = 16 + Math.pow(16, shops.length) * shops.length;

        if (user.balance < price) {
            return reply.status(402).send({message: "Недостаточно средств. Не хватает: " + (price - user.balance)});
        }

        // here

        return reply.status(200).send(user);
    })
}
