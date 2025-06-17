'use strict'

const { Op } = require("sequelize");

module.exports = async function (fastify, opts) {
    fastify.addHook('onRequest', async (request, reply) => {
        try {
            const { User, Shop, ShopCoOwner } = fastify.sequelize.models;
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

            const shop = await Shop.findOne({
                where: { id: request.params.shop },
                include: {
                    model: ShopCoOwner,
                    as: "co_owners",
                    where: {
                        userId: request.user.id,
                        status: "pending"
                    },
                    required: true
                },
                attributes: ['id', 'name', 'description', 'icon', 'tag', 'verify_status']
            });

            if (!shop) {
                return reply.status(400).send({
                    message: "Приглашение не найдено или у вас нет доступа к этому магазину."
                });
            }

            request.shop = shop;
        } catch (err) {
            return reply.status(401).send({ error: 'Unauthorized' });
        }
    });

    fastify.post('/invites/accept', async function (request, reply) {
        const { ShopCoOwner } = fastify.sequelize.models;

        const coOwner = await ShopCoOwner.findOne({
            where: {
                shopId: request.shop.id,
                userId: request.user.id,
                status: 'pending'
            }
        });

        if (!coOwner) {
            return reply.status(400).send({ message: 'Приглашение не найдено или уже обработано.' });
        }

        coOwner.status = 'accepted';
        await coOwner.save();

        return reply.send({ message: 'Приглашение принято.' });
    });

    fastify.post('/invites/decline', async function (request, reply) {
        const { ShopCoOwner } = fastify.sequelize.models;

        const coOwner = await ShopCoOwner.findOne({
            where: {
                shopId: request.shop.id,
                userId: request.user.id,
                status: 'pending'
            }
        });

        if (!coOwner) {
            return reply.status(400).send({ message: 'Приглашение не найдено или уже обработано.' });
        }

        coOwner.status = 'declined';
        await coOwner.save();

        return reply.send({ message: 'Приглашение отклонено.' });
    });
};
