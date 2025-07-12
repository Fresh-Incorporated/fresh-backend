import {FastifyPluginAsync} from 'fastify';
import {json, Op, where} from 'sequelize';
import {UserWebpush} from '../../../models/UserWebpush';
import {NotificationSettings} from "../../../models/NotificationSettings";
import {NotificationPermissionKey, notifyUser} from "../../../utils/notifyUtil";

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
    fastify.post<{
        Body: { subscription: any }
    }>('/notifications/subscribe', {preHandler: fastify.requireAuth}, async (request, reply) => {
        const {subscription} = request.body;
        const [entry, created] = await UserWebpush.findOrCreate({
            where: {
                userId: request.user!.id,
                [Op.and]: [
                    where(json('data.endpoint') as any, subscription.endpoint)
                ]
            },
            defaults: {
                data: subscription,
                userId: request.user!.id,
                enabled: true
            } as any
        });
        if (!created && !entry.enabled) {
            entry.enabled = true;
            await entry.save();
        }
        return reply.status(200).send();
    });

    fastify.post<{
        Body: { endpoint: string }
    }>('/notifications/unsubscribe', {preHandler: fastify.requireAuth}, async (request, reply) => {
        const {endpoint} = request.body;
        await UserWebpush.update(
            {enabled: false},
            {
                where: {
                    userId: request.user!.id,
                    [Op.and]: [
                        where(json('data.endpoint') as any, endpoint)
                    ]
                }
            }
        );
        return reply.status(200).send();
    });

    fastify.post<{
        Body: {
            settings: {
                webpush?: Partial<Pick<NotificationSettings, NotificationPermissionKey>>,
                discord?: Partial<Pick<NotificationSettings, NotificationPermissionKey>>
            }
        }
    }>('/notifications/settings', { preHandler: fastify.requireAuth }, async (request, reply) => {
        const userId = request.user!.id;
        const settings = request.body.settings;

        for (const target of Object.keys(settings)) {
            const options = settings[target as 'webpush' | 'discord'];
            if (!options) continue;

            const [entry, created] = await NotificationSettings.findOrCreate({
                where: { userId, target },
                defaults: {
                    userId,
                    target,
                    market_shop: options.market_shop ?? false,
                    market_delivered: options.market_delivered ?? false,
                    market_work: options.market_work ?? false,
                    priority: options.priority ?? false,
                } as any
            });

            if (!created) {
                await entry.update({
                    market_shop: options.market_shop ?? entry.market_shop,
                    market_delivered: options.market_delivered ?? entry.market_delivered,
                    market_work: options.market_work ?? entry.market_work,
                    priority: options.priority ?? entry.priority,
                });
            }
        }

        return reply.status(200).send({ message: 'Настройки уведомлений обновлены' });
    });

    fastify.get('/notifications/settings', { preHandler: fastify.requireAuth }, async (request, reply) => {
        const userId = request.user!.id;

        const settings = await NotificationSettings.findAll({
            where: { userId },
        });

        const formatted = settings.reduce((acc, setting) => {
            acc[setting.target] = {
                market_shop: setting.market_shop,
                market_delivered: setting.market_delivered,
                market_work: setting.market_work,
            };
            return acc;
        }, {} as Record<string, { market_shop: boolean, market_delivered: boolean, market_work: boolean }>);

        return reply.status(200).send({ settings: formatted });
    });

    fastify.post('/notifications/test', {preHandler: fastify.requireAuth}, async (request, reply) => {
        notifyUser(fastify, request.user!.id, 'Test уведомление', 'Оно работает!', '/', null)
        reply.send({success: true});
    });
};

export default route;