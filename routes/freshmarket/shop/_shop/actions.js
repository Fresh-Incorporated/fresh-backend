'use strict'

const { uploadToS3 } = require("../../../../utils/s3Util");
const {Op} = require("sequelize");
module.exports = async function (fastify, opts) {
    fastify.post('/withdraw', { preHandler: fastify.requireShopAccess }, async function (request, reply) {
        const User = fastify.sequelize.model('User');
        const Shop = fastify.sequelize.model('Shop');
        const ShopHistory = fastify.sequelize.model('ShopHistory');
        const BalanceHistory = fastify.sequelize.model('BalanceHistory');


        const value = Math.floor(request.shop.balance);
        if (value < 10) {
            return reply.status(400).send({message: "Минимальная сумма вывода: 10 АР"});
        }
        await request.shop.decrement({balance: value})
        await request.user.increment({balance: value})
        await ShopHistory.create({
            action_type: "withdraw",
            userId: request.user.id, // Тот кто вывел средства магазина
            shopId: request.shop.id,
            data: {
                value
            },
        })
        await BalanceHistory.create({
            action_type: "freshmarket_shop_withdraw",
            message: "Вывод средств из магазина " + request.shop.name + " [" + request.shop.id + "]",
            userId: request.user.id,
            value: value
        })
        return reply.status(200).send({message: "Средства магазина переведены на ваш аккаунт!"});
    });
};
