'use strict'

const { Op } = require("sequelize");

module.exports = async function (fastify, opts) {
    fastify.post('/invites/accept', { preHandler: fastify.requireAuth }, async function (request, reply) {
        const { User, Shop,ShopCoOwner } = fastify.sequelize.models;

        const shop = await Shop.findOne({
            where: { id: request.params.shop },
            attributes: ['id'],
        });

        if (!shop) {
            return reply.status(400).send({ message: 'Магазин не найден.' });
        }

        const coOwner = await ShopCoOwner.findOne({
            where: {
                shopId: shop.id,
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

    fastify.post('/invites/decline', { preHandler: fastify.requireAuth }, async function (request, reply) {
        const { User, Shop,ShopCoOwner } = fastify.sequelize.models;

        const shop = await Shop.findOne({
            where: { id: request.params.shop },
            attributes: ['id'],
        });

        const coOwner = await ShopCoOwner.findOne({
            where: {
                shopId: shop.id,
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
