'use strict'

const {uploadToS3} = require("../../../../utils/s3Util");
const {Op, literal} = require("sequelize");
module.exports = async function (fastify, opts) {
    fastify.addHook('onRequest', async (request, reply) => {
        const User = fastify.sequelize.model('User');
        try {
            const accessToken = request.cookies.access_token;
            if (!accessToken) {
                return reply.status(401).send({error: 'Missing access token'});
            }

            request.user = fastify.jwt.verify(accessToken);

            request.user = await User.findOne({
                where: {
                    id: request.user.id
                },
                attributes: {exclude: ['updatedAt']},
            });

            if (!request.user) {
                return reply.status(400).send({
                    message: "Пользователь не найден."
                });
            }

            if (request.user.fm_worker < 4) {
                return reply.status(403).send({
                    message: "Недостаточно прав."
                });
            }
        } catch (err) {
            reply.status(401).send({error: 'Unauthorized'});
        }
    });

    fastify.get('/balance', async function (request, reply) {
        const Order = fastify.sequelize.model('Order');
        const OrderHistory = fastify.sequelize.model('OrderHistory');
        const ProductHistory = fastify.sequelize.model('ProductHistory');
        const Shop = fastify.sequelize.model('Shop');
        const User = fastify.sequelize.model('User');

        const orders = await Order.findAll({
            where: {
                id: {
                    [Op.gte]: 1
                },
            },
            attributes: ["id", "type", "price", "status", "customerId"]
        });
        const users = await User.findAll({
            attributes: ["id"]
        });

        const totalCommissionBalance = orders.reduce((acc, order) => acc + (order.price * 0.1), 0);

        let totalSpentOnShops = 0;
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

        return reply.status(200).send({totalCommissionBalance, totalSpentOnShops});
    });
};
