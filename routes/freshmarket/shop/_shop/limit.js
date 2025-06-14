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

        if (!count || count <= 0 || count > 100) {
            return reply.status(400).send({ message: 'Неверное количество.' });
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

                const shop = await Shop.findOne({
                    where: { id: request.params.shop, ownerId: user.id },
                    transaction: t
                });

                if (!shop) {
                    throw new Error("Магазин не существует или у вас недостаточно прав.");
                }

                const current_limit = shop.products_limit;

                if (current_limit + count > 25) {
                    throw new Error("На данный момент максимальный лимит — 25.");
                }

                const price = Math.ceil(20 * count * (1 - 0.15 * Math.log10(count + 1)));

                if (user.balance < price) {
                    throw new Error("Недостаточно средств, пополните баланс.");
                }

                await shop.increment({ products_limit: count }, { transaction: t });

                await User.update(
                    { balance: user.balance - price },
                    { where: { id: user.id }, transaction: t }
                );

                await ShopHistory.create({
                    action_type: "limit_increase",
                    userId: user.id,
                    shopId: shop.id,
                    data: { count }
                }, { transaction: t });

                await BalanceHistory.create({
                    action_type: "freshmarket_pay",
                    message: `Увеличение лимита магазина ${shop.name} [${shop.id}]`,
                    userId: user.id,
                    value: -price
                }, { transaction: t });
            });

            return reply.status(200).send({ message: "Лимит магазина увеличен!" });

        } catch (err) {
            return reply.status(400).send({ message: err.message || "Ошибка при увеличении лимита." });
        }
    });
};
