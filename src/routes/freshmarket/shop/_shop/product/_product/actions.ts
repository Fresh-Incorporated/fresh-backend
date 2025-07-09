import { FastifyPluginAsync } from 'fastify';
import { Op, Sequelize } from 'sequelize';
import { Order } from '../../../../../../models/Order';

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post('/delete', { preHandler: fastify.requireProductAccess }, async (request, reply) => {
    request.assertShopPermission('delete_products');
    const product = request.product;
    if (!product) return reply.status(400).send({ message: 'Товар не найден.' });

    if (product.count > 0) {
      return reply.status(400).send({ message: 'Нельзя удалить товар который есть на складе!' });
    }

    if (product.refill_status > 0) {
      return reply.status(400).send({ message: 'Нельзя удалить товар который пополняется!' });
    }

    const order = await Order.findOne({
      where: {
        status: { [Op.lt]: 2 },
        [Op.and]: Sequelize.literal(`"data"->'products' @> '[{"id": ${product.id}}]'`)
      }
    });
    const exists = !!order;
    if (exists) {
      return reply.status(400).send({ message: 'Нельзя удалить товар который выполняется в заказе! (Попробуйте позже)' });
    }

    await product.destroy();
    return reply.status(200).send({ message: 'Товар удалён' });
  });
};

export default route;
