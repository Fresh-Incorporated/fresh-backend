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

    fastify.post('/limit/increase', async function (request, reply) {
        const User = fastify.sequelize.model('User');
        const Shop = fastify.sequelize.model('Shop');
        const ShopHistory = fastify.sequelize.model('ShopHistory');
        const BalanceHistory = fastify.sequelize.model('BalanceHistory');

        const count = parseInt(request.body.count);

        if (count <= 0 || count > 100) {
            return reply.status(400).send({ message: 'Bad Request' });
        }

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

        const current_limit = shop.products_limit

        if (current_limit + count > 25) {
            return reply.status(400).send({
                message: "На данный момент максимальный лимит - 25"
            });
        }

        const price = Math.ceil(20 * count * (1 - 0.15 * Math.log10(count + 1)));

        if (user.balance < price) {
            return reply.status(400).send({
                message: "Недостаточно средств, пополните баланс."
            })
        }

        await shop.increment({products_limit: count})
        await user.decrement({balance: price})
        await ShopHistory.create({
            action_type: "limit_increase",
            userId: user.id, // Тот кто увеличил лимит магазина
            shopId: shop.id,
            data: {
                count
            },
        })
        await BalanceHistory.create({
            action_type: "freshmarket_pay",
            message: "Увеличение лимита магазина " + shop.name + " [" + shop.id + "]",
            userId: user.id,
            value: -price
        })
        return reply.status(200).send({message: "Лимит магазина увеличен!", limit: count + current_limit});
    });
};
