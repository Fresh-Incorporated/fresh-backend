import { FastifyPluginAsync } from 'fastify';
import { Op, where, json } from 'sequelize';
import { UserWebpush } from '../../../models/UserWebpush';

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post<{ Body: { subscription: any } }>('/notifications/subscribe', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { subscription } = request.body;
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
    return reply.status(200).send({ message: 'Push-уведомления включены' });
  });

  fastify.post<{ Body: { endpoint: string } }>('/notifications/unsubscribe', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { endpoint } = request.body;
    await UserWebpush.update(
      { enabled: false },
      {
        where: {
          userId: request.user!.id,
          [Op.and]: [
            where(json('data.endpoint') as any, endpoint)
          ]
        }
      }
    );
    return reply.status(200).send({ message: 'Push-уведомления отключены' });
  });

  fastify.post('/notifications/test', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const subscriptions = await UserWebpush.findAll({
      where: {
        userId: request.user!.id,
        enabled: true
      }
    });
    try {
      for (const subscription of subscriptions) {
        await fastify.webpush.sendNotification(subscription.data, JSON.stringify({
          title: 'Test уведомление',
          options: {
            body: 'Привет! Это тест.',
            icon: '/logo.png',
            badge: '/logo.png',
            silent: false,
            data: {
              url: (process.env.FRONTEND_URL || '') + '/cabinet'
            }
          }
        }));
      }
    } catch (err) {
      console.error(err);
    }
    reply.send({ success: true });
  });
};

export default route;