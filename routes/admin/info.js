'use strict'

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

            if (!request.user.admin) {
                return reply.status(400).send({
                    message: "Недостаточно прав."
                });
            }
        } catch (err) {
            reply.status(401).send({error: 'Unauthorized'})
        }
    });

    fastify.get('/stats', async function (request, reply) {
        const User = fastify.sequelize.model('User');
        const Shop = fastify.sequelize.model('Shop');

        const user = await User.findOne({
            where: {
                id: request.user.id,
                admin: true
            },
            attributes: { exclude: ['updatedAt'] },
        });

        const totalUsers = await User.count();

        if (!user) {
            return reply.status(400).send({
                message: "Пользователь не найден или недостаточно прав."
            });
        }

        const users = await User.findAll({

        });

        const shops = await Shop.findAll({

        });

        let totalSpentOnShops = 0;
        const totalBalanceUsers = users.reduce((sum, user) => sum + user.balance, 0);
        const totalBalanceShops = shops.reduce((sum, shop) => sum + shop.balance, 0);

        for (const user of users) {
            const shopCount = await Shop.count({ where: { ownerId: user.id } });

            if (shopCount > 0) {
                let cost = 0;
                for (let i = 0; i < shopCount; i++) {
                    cost += 16 + 64 * i;
                }
                totalSpentOnShops += cost;
            }
        }

        return reply.status(200).send({totalSpentOnShops, totalBalanceUsers, totalBalanceShops, totalUsers});
    });
};
