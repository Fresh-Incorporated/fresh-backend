'use strict'

const {Op, where, json} = require("sequelize");
module.exports = async function (fastify, opts) {
    fastify.post('/notifications/subscribe', { preHandler: fastify.requireAuth }, async function (request, reply) {
        const UserWebpush = fastify.sequelize.model('UserWebpush');
        const { subscription } = request.body;

        const [entry, created] = await UserWebpush.findOrCreate({
            where: {
                userId: request.user.id,
                // сравниваем по endpoint в JSON
                [Op.and]: [
                    where(
                        json('data.endpoint'),
                        subscription.endpoint
                    )
                ]
            },
            defaults: {
                data: subscription,
                userId: request.user.id,
                enabled: true
            }
        });

        if (!created && entry.enabled === false) {
            entry.enabled = true;
            await entry.save();
        }

        return reply.status(200).send({ message: 'Push-уведомления включены' });
    });

    fastify.post('/notifications/unsubscribe', { preHandler: fastify.requireAuth }, async function (request, reply) {
        const UserWebpush = fastify.sequelize.model('UserWebpush');
        const { endpoint } = request.body;

        await UserWebpush.update(
            { enabled: false },
            {
                where: {
                    userId: request.user.id,
                    [Op.and]: [
                        where(
                            json('data.endpoint'),
                            endpoint
                        )
                    ]
                }
            }
        );

        return reply.status(200).send({ message: 'Push-уведомления отключены' });
    });

    fastify.post('/notifications/test', { preHandler: fastify.requireAuth }, async (request, reply) => {
        const UserWebpush = fastify.sequelize.model('UserWebpush');
        const subscriptions = await UserWebpush.findAll({
            where: {
                userId: request.user.id,
                enabled: true
            }
        });

        try {
            for (const subscription of subscriptions) {
                await fastify.webpush.sendNotification(subscription.data, JSON.stringify({
                    title: "Test уведомление",
                    options: {
                        body: "Привет! Это тест.",
                        icon: "/logo.png",
                        badge: "/logo.png",
                        silent: false,
                        data: {
                            url: process.env.FRONTEND_URL + "/cabinet"
                        }
                    }
                }));
            }
        } catch (err) {
            console.error(err);
        }

        reply.send({ success: true });
    });
}