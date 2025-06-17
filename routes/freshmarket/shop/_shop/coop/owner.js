'use strict'

const { uploadToS3 } = require("../../../../../utils/s3Util");
const {Op} = require("sequelize");
const {notifyUser} = require("../../../../../utils/notifyUtil");
module.exports = async function (fastify, opts) {
    fastify.addHook('onRequest', async (request, reply) => {
        try {
            const { User, Shop } = fastify.sequelize.models;
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
                where: { id: request.params.shop, ownerId: request.user.id },
                attributes: ['id', 'name', 'description', 'icon', 'tag', 'verify_status']
            });

            if (!shop) {
                return reply.status(400).send({
                    message: "Магазин не существует или у вас недостаточно прав."
                });
            }

            request.shop = shop
        } catch (err) {
            reply.status(401).send({ error: 'Unauthorized' });
        }
    });

    fastify.post('/invite', async function (request, reply) {
        const { ShopCoOwner, User } = fastify.sequelize.models;

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

    fastify.post('/delete', async function (request, reply) {
        const { ShopCoOwner, User } = fastify.sequelize.models;

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
};
