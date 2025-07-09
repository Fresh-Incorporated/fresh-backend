import { FastifyPluginAsync } from 'fastify';
import { Op, Sequelize } from 'sequelize';
import { notifyWorkers } from '../../../../../../utils/notifyUtil';
import { User } from '../../../../../../models/User';
import { Order } from '../../../../../../models/Order';
import { OrderHistory } from '../../../../../../models/OrderHistory';
import { Location } from '../../../../../../models/Location';
import { LocationCell } from '../../../../../../models/LocationCell';

interface Params {
  order: string;
}

const route: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.addHook<{ Params: Params }>('onRequest', async (request, reply) => {
    try {
      const accessToken = request.cookies.access_token;
      if (!accessToken) {
        return reply.status(401).send({ error: 'Missing access token' });
      }
      const jwtUser = fastify.jwt.verify(accessToken) as { id: number };
      const dbUser = await User.findOne({
        where: { id: jwtUser.id },
        attributes: { exclude: ['updatedAt'] },
      });
      if (!dbUser) {
        return reply.status(400).send({ message: 'Пользователь не найден.' });
      }
      if (dbUser.fm_worker < 2) {
        return reply.status(403).send({ message: 'Недостаточно прав.' });
      }
      request.user = dbUser;
      const order = await Order.findOne({
        where: { id: request.params.order },
      });
      if (!order) {
        return reply.status(400).send({ message: 'Заказ не найден.' });
      }
      (request as any).order = order;
    } catch (err) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  fastify.post<{ Params: Params }>('/collect', async (request, reply) => {
    const order = (request as any).order;
    const user = request.user;
    if (!order || !user) {
      return reply.status(400).send({ message: 'Не удалось получить пользователя или заказ.' });
    }
    if (order.status !== 0) {
      return reply.status(400).send({ message: 'Задача недоступна (Возможно уже выполняется другим работником)' });
    }
    const cell = await LocationCell.findOne({
      where: {
        id: {
          [Op.notIn]: Sequelize.literal(
            `(SELECT DISTINCT "deliverCellId" FROM "orders" WHERE "deliverCellId" IS NOT NULL)`
          ),
        },
      },
      include: [
        {
          model: Location,
          as: 'location',
          where: {
            type: 'deliver',
            enabled: true,
          },
        },
      ],
    });
    if (!cell) {
      return reply.status(500).send({ message: 'Не получилось найти свободную ячейку для курьера, попробуйте позже..' });
    }
    await order.update({
      status: 1,
      currentWorkerId: user.id,
      deliverCellId: cell.id,
    });
    await OrderHistory.create({
      action_type: 'collect_picked',
      userId: user.id,
      orderId: order.id,
    } as any);
    return reply.status(200).send({ message: 'Задача на сбор заказа принята!' });
  });

  fastify.post<{ Params: Params }>('/collect/end', async (request, reply) => {
    const order = (request as any).order;
    const user = request.user;
    if (!order || !user) {
      return reply.status(400).send({ message: 'Не удалось получить пользователя или заказ.' });
    }
    if (order.status !== 1 || order.currentWorkerId !== user.id) {
      return reply.status(400).send({ message: 'Задача недоступна (Возможно уже завершена)' });
    }
    if (order.deliverCellId == null) {
      return reply.status(400).send({ message: 'Не присвоена ячейка курьера! (Обратитесь к директору)' });
    }
    await order.update({
      status: 2,
      currentWorkerId: null,
    });
    await OrderHistory.create({
      action_type: 'collect_finished',
      userId: user.id,
      orderId: order.id,
    } as any);
    await notifyWorkers(
      fastify,
      1,
      'fm_delivery',
      'Новая доставка',
      'Доставьте его как можно скорей!',
      '/cabinet/freshmarket/work/delivery'
    );
    return reply.status(200).send({ message: 'Задача на сбор заказа завершена!' });
  });
};

export default route;
