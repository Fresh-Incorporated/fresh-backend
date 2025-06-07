'use strict'

const {Op, where, json} = require("sequelize");
module.exports = async function (fastify, opts) {
    fastify.addHook('onRequest', async (request, reply) => {
        const User = fastify.sequelize.model('User');
        try {
            const accessToken = request.cookies.access_token
            if (!accessToken) {
                return reply.status(401).send({ error: 'Missing access token' })
            }

            request.user = fastify.jwt.verify(accessToken)

            request.user = await User.findOne({
                where: { id: request.user.id },
                attributes: { exclude: ['updatedAt'] },
            });
        } catch (err) {
            reply.status(401).send({ error: 'Unauthorized' })
        }
    })

    fastify.post('/notifications/subscribe', async function (request, reply) {
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

    fastify.post('/notifications/unsubscribe', async function (request, reply) {
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

    fastify.post('/notifications/test', async (request, reply) => {
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