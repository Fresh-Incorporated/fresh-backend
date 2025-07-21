import { FastifyPluginAsync } from 'fastify';
import { Op } from 'sequelize';
import { User } from '../../../../models/User';
import {Order} from "../../../../models/Order";
import {Location} from "../../../../models/Location";
import {LocationCell} from "../../../../models/LocationCell";
import {OrderHistory} from "../../../../models/OrderHistory";
import {Product} from "../../../../models/Product";

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      const accessToken = request.cookies.access_token;
      if (!accessToken) {
        return reply.status(401).send({ error: 'Missing access token' });
      }
      const jwtUser = fastify.jwt.verify(accessToken) as { id: number };
      const user = await User.findOne({ where: { id: jwtUser.id }, attributes: { exclude: ['updatedAt'] } });
      if (!user) {
        return reply.status(400).send({ message: 'Пользователь не найден.' });
      }
      if (user.fm_worker < 3) {
        return reply.status(403).send({ message: 'Недостаточно прав.' });
      }
      (request as any).user = user;
    } catch (err) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  fastify.get('/orders/deprecated', async (request, reply) => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const orders = await Order.findAll({
      where: {
        status: 4,
        createdAt: {
          [Op.lte]: threeDaysAgo
        }
      },
      include: [
        { model: User, as: 'customer', attributes: ['id', 'uuid', 'nickname'] },
        { model: Location, as: 'branch' },
        { model: LocationCell, as: 'branchCell' },
      ],
      limit: 30,
      order: [['id', 'DESC']],
    });

    const products = await Product.findAll({
      where: { id: orders.map(o => ((o.data as any).products as Product[]).map(p => p.id)).flat(1) },
      paranoid: false,
    });
    return reply.status(200).send({ orders, products });
  });

  fastify.post<{ Params: { order: string } }>('/order/:order/confirm', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const order = await Order.findOne({
      where: {
        id: request.params.order,
      },
      attributes: ['id', 'status']
    });
    if (!order) {
      return reply.status(400).send({ message: 'Заказ не найден.' });
    }
    if (order.status < 4) {
      return reply.status(400).send({ message: 'Заказ ещё не доставили.' });
    }
    if (order.status >= 5) {
      return reply.status(400).send({ message: 'Вы уже подтвердили этот заказ.' });
    }
    await order.update({
      status: 5,
      branchCellId: undefined,
    });
    await OrderHistory.create({
      action_type: 'confirmed',
      userId: request.user!.id,
      orderId: order.id,
    } as any);
    return reply.status(200).send({ message: 'Получение подтверждено.' });
  });
};

export default route;
