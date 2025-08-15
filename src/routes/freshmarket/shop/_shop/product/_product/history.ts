import { FastifyPluginAsync } from 'fastify';
import { User } from '../../../../../../models/User';
import { ProductHistory } from '../../../../../../models/ProductHistory';

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get('/history', { preHandler: [fastify.requireProductAccess] }, async (request, reply) => {
    const product = request.product;
    if (!product) return reply.status(400).send({ message: 'Товар не найден.' });
    const history = await ProductHistory.findAll({
      where: { productId: product.id },
      attributes: ['id', 'action_type', 'userId', 'productId', 'data', 'message', 'createdAt'],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'nickname', 'uuid', 'discordId'],
        },
      ],
      limit: 100,
      order: [['createdAt', 'DESC']],
    });
    return reply.status(200).send(history);
  });
};

export default route;
