'use strict'

const { uploadToS3 } = require("../../../../utils/s3Util");
const {Op} = require("sequelize");
module.exports = async function (fastify, opts) {
    fastify.addHook('onRequest', async (request, reply) => {
        try {
            const accessToken = request.cookies.access_token;
            if (!accessToken) {
                return reply.status(401).send({ error: 'Missing access token' });
            }

            request.user = fastify.jwt.verify(accessToken);
        } catch (err) {
            reply.status(401).send({ error: 'Unauthorized' });
        }
    });

    fastify.post('/withdraw', async function (request, reply) {
        const User = fastify.sequelize.model('User');
        const Shop = fastify.sequelize.model('Shop');
        const ShopHistory = fastify.sequelize.model('ShopHistory');
        const BalanceHistory = fastify.sequelize.model('BalanceHistory');

        const user = await User.findOne({
            where: {
                id: request.user.id
            },
            attributes: ['id'],
        });

        if (!user) {
            return reply.status(400).send({
                message: "Пользователь не найден."
            });
        }

        const shop = await Shop.findOne({where: { id: request.params.shop, ownerId: request.user.id }});

        if (!shop) {
            return reply.status(400).send({
                message: "Магазин не существует или у вас недостаточно прав."
            });
        }

        const value = Math.floor(shop.balance);
        if (value < 10) {
            return reply.status(400).send({message: "Минимальная сумма вывода: 10 АР"});
        }
        await shop.decrement({balance: value})
        await user.increment({balance: value})
        await ShopHistory.create({
            action_type: "withdraw",
            userId: user.id, // Тот кто вывел средства магазина
            shopId: shop.id,
            data: {
                value
            },
        })
        await BalanceHistory.create({
            action_type: "freshmarket_shop_withdraw",
            message: "Вывод средств из магазина " + shop.name + " [" + shop.id + "]",
            value: value
        })
        return reply.status(200).send({message: "Средства магазина переведены на ваш аккаунт!"});
    });
};
