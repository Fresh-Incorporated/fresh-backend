'use strict'

const { uploadToS3 } = require("../../../../utils/s3Util");
module.exports = async function (fastify, opts) {
    fastify.addHook('onRequest', async (request, reply) => {
        const User = fastify.sequelize.model('User');
        try {
            const accessToken = request.cookies.access_token;
            if (!accessToken) {
                return reply.status(401).send({ error: 'Missing access token' });
            }

            request.user = fastify.jwt.verify(accessToken);

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

            if (request.user.fm_worker < 3) {
                return reply.status(403).send({
                    message: "Недостаточно прав."
                });
            }
        } catch (err) {
            reply.status(401).send({ error: 'Unauthorized' });
        }
    });

    fastify.post('/shop/:id/accept', async function (request, reply) {
        const Shop = fastify.sequelize.model('Shop');

        const shop = await Shop.findOne({
            where: {
                id: request.params.id,
                verify_status: 0
            }
        });

        if (!shop) {
            return reply.status(400).send({
                message: "Магазин не найден (Возможно уже проверен)."
            });
        }

        await shop.update({verify_status: 1});

        return reply.status(200).send({
            message: "Магазин подтверждён"
        });
    });

    fastify.post('/shop/:id/decline', async function (request, reply) {
        const Shop = fastify.sequelize.model('Shop');

        const shop = await Shop.findOne({
            where: {
                id: request.params.id,
                verify_status: 0
            }
        });

        if (!shop) {
            return reply.status(400).send({
                message: "Магазин не найден (Возможно уже проверен)."
            });
        }

        await shop.update({verify_status: -1});

        return reply.status(200).send({
            message: "Магазин отклонён"
        });
    });

    fastify.get('/shops', async function (request, reply) {
        const Shop = fastify.sequelize.model('Shop');

        const shops = await Shop.findAll({
            where: {
                verify_status: 0
            }
        });

        return reply.status(200).send(shops);
    });
};
