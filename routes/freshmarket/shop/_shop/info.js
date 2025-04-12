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

    fastify.get('/sells', async function (request, reply) {
        const User = fastify.sequelize.model('User');
        const Shop = fastify.sequelize.model('Shop');
        const ShopHistory = fastify.sequelize.model('ShopHistory');

        const user = await User.findOne({
            where: {
                id: request.user.id
            },
            attributes: { exclude: ['updatedAt'] },
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

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const orderedHistory = await ShopHistory.findAll({
            where: {
                action_type: "ordered",
                createdAt: {
                    [Op.gte]: sevenDaysAgo
                }
            }
        })

        return reply.status(200).send(orderedHistory);
    });
};
