import { FastifyPluginAsync } from 'fastify';
import { Order } from '../../../models/Order';
import { OrderHistory } from '../../../models/OrderHistory';

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post<{ Params: { order: string } }>('/:order/confirm', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const order = await Order.findOne({
      where: {
        id: request.params.order,
        customerId: request.user!.id
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
