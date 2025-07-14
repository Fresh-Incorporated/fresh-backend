import { FastifyPluginAsync } from 'fastify';
import { User } from '../../../../models/User';
import { ShopHistory } from '../../../../models/ShopHistory';

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get('/history', {
    preHandler: [fastify.requireShopAccess]
  }, async (request, reply) => {
    if (!request.shop) return reply.status(400).send({ message: 'Магазин не найден.' });
    const history = await ShopHistory.findAll({
      where: { shopId: request.shop.id },
      attributes: ['id', 'action_type', 'userId', 'shopId', 'data', 'message', 'createdAt'],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'nickname', 'uuid'],
        }
      ],
      limit: 100,
    });
    return reply.status(200).send(history);
  });
};

export default route;
