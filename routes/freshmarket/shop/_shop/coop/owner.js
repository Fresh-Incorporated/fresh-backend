'use strict'

const { uploadToS3 } = require("../../../../../utils/s3Util");
const {Op} = require("sequelize");
const {notifyUser} = require("../../../../../utils/notifyUtil");
module.exports = async function (fastify, opts) {
    fastify.post('/invite', { preHandler: fastify.requireShopAccess }, async function (request, reply) {
        const { ShopCoOwner, User } = fastify.sequelize.models;

        if (!request.isOwner) return reply.status(400).send({
            message: "Магазин не существует или у вас недостаточно прав."
        });

        const { uuid, permissions } = request.body
        if (!uuid || typeof uuid !== 'string') {
            return reply.status(400).send({ message: 'Укажите пользователя (uuid)' });
        }

        if (!permissions || typeof permissions !== 'object') {
            return reply.status(400).send({ message: 'Укажите права доступа' });
        }

        // Запрет на приглашение самого себя
        if (uuid === request.user.uuid) {
            return reply.status(400).send({ message: 'Вы не можете пригласить самого себя' });
        }

        // Проверяем, что пользователь существует
        const invitedUser = await User.findOne({
            where: { uuid },
            attributes: ['id', 'uuid']
        });

        if (!invitedUser) {
            return reply.status(404).send({ message: 'Пользователь не найден' });
        }

        // Проверяем, что он ещё не совладелец
        const existingCoOwner = await ShopCoOwner.findOne({
            where: {
                shopId: request.shop.id,
                userId: invitedUser.id,
                status: {
                    [Op.in]: ["pending", "accepted"]
                }
            }
        });

        if (existingCoOwner) {
            return reply.status(400).send({ message: 'Этот пользователь уже приглашён или является совладельцем' });
        }

        // Создаём приглашение
        await ShopCoOwner.create({
            shopId: request.shop.id,
            userId: invitedUser.id,
            status: 'pending',
            edit_shop_info: !!permissions.edit_shop_info,
            create_products: !!permissions.create_products,
            edit_products: !!permissions.edit_products,
            refill_products: !!permissions.refill_products,
            delete_products: !!permissions.delete_products
        });

        notifyUser(fastify, request.shop.ownerId, "fm_invited_shop_" + request.shop.id, "Приглашение в магазин", "Вас пригласили в магазин " + request.shop.name, "/cabinet/freshmarket/invites")

        return reply.send({ message: 'Приглашение отправлено' });
    });

    fastify.post('/delete', { preHandler: fastify.requireShopAccess }, async function (request, reply) {
        const { ShopCoOwner, User } = fastify.sequelize.models;

        if (!request.isOwner) return reply.status(400).send({
            message: "Магазин не существует или у вас недостаточно прав."
        });

        const { id } = request.body
        if (!id) {
            return reply.status(400).send({ message: 'Укажите пользователя' });
        }

        const user = await User.findOne({
            where: { id },
            attributes: ['id']
        });

        if (!user) {
            return reply.status(404).send({ message: 'Пользователь не найден' });
        }

        const existingCoOwner = await ShopCoOwner.findOne({
            where: {
                shopId: request.shop.id,
                userId: user.id,
            }
        });

        if (!existingCoOwner) {
            return reply.status(400).send({ message: 'Этот пользователь не совладелец' });
        }

        await existingCoOwner.destroy()

        notifyUser(fastify, user.id, "fm_removed_from_shop_" + user.id, "Удаление из магазина", "Вас больше не совладелец магазина " + request.shop.name, "/cabinet")

        return reply.send({ message: 'Пользователь больше не является совладельцем.' });
    });

    fastify.post('/edit', { preHandler: fastify.requireShopAccess }, async function (request, reply) {
        const { ShopCoOwner, User } = fastify.sequelize.models;

        if (!request.isOwner) {
            return reply.status(400).send({
                message: "Магазин не существует или у вас недостаточно прав."
            });
        }

        const { id, permissions } = request.body;

        if (!id) {
            return reply.status(400).send({ message: 'Укажите пользователя' });
        }

        const targetUser = await User.findOne({
            where: { id },
            attributes: ['id']
        });

        if (!targetUser) {
            return reply.status(404).send({ message: 'Пользователь не найден' });
        }

        // Проверяем, что он является совладельцем
        const coOwner = await ShopCoOwner.findOne({
            where: {
                shopId: request.shop.id,
                userId: targetUser.id,
                status: 'accepted'
            }
        });

        if (!coOwner) {
            return reply.status(400).send({ message: 'Этот пользователь не является совладельцем' });
        }

        // Обновляем права
        await coOwner.update({
            edit_shop_info: !!permissions.edit_shop_info,
            create_products: !!permissions.create_products,
            edit_products: !!permissions.edit_products,
            refill_products: !!permissions.refill_products,
            delete_products: !!permissions.delete_products
        });

        notifyUser(fastify, targetUser.id, "fm_permissions_updated_" + targetUser.id, "Изменение прав в магазине", "Ваши права в магазине " + request.shop.name + " были изменены", "/cabinet");

        return reply.send({ message: 'Права пользователя обновлены.' });
    });

};
