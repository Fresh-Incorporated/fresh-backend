'use strict'

const { Op } = require("sequelize");

module.exports = async function (fastify, opts) {
    fastify.post('/invites/accept', { preHandler: fastify.requireShopAccess }, async function (request, reply) {
        const { ShopCoOwner } = fastify.sequelize.models;

        const shop = await request.shop.reload({
            attributes: ['id', 'name', 'description', 'icon', 'tag', 'verify_status'],
            include: {
                model: ShopCoOwner,
                as: "co_owners",
                where: {
                    userId: request.user.id,
                    status: "pending"
                },
                required: true
            },
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

        coOwner.status = 'accepted';
        await coOwner.save();

        return reply.send({ message: 'Приглашение принято.' });
    });

    fastify.post('/invites/decline', { preHandler: fastify.requireShopAccess }, async function (request, reply) {
        const { ShopCoOwner } = fastify.sequelize.models;

        const shop = await request.shop.reload({
            attributes: ['id', 'name', 'description', 'icon', 'tag', 'verify_status'],
            include: {
                model: ShopCoOwner,
                as: "co_owners",
                where: {
                    userId: request.user.id,
                    status: "pending"
                },
                required: true
            },
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
