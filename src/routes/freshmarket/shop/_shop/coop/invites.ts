import { FastifyPluginAsync } from 'fastify';
import {ShopCoOwner} from "../../../../../models/ShopCoOwner";
import {Shop} from "../../../../../models/Shop";

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post<{ Params: { shop: string } }>('/invites/accept', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = request.user;

    const shop = await Shop.findOne({
      where: { id: request.params.shop },
      attributes: ['id'],
    });
    if (!shop) {
      return reply.status(400).send({ message: 'Магазин не найден.' });
    }
    const coOwner = await ShopCoOwner.findOne({
      where: {
        shopId: shop.id,
        userId: user.id,
        status: 'pending',
      },
    });
    if (!coOwner) {
      return reply.status(400).send({ message: 'Приглашение не найдено или уже обработано.' });
    }
    coOwner.status = 'accepted';
    await coOwner.save();
    return reply.send({ message: 'Приглашение принято.' });
  });

  fastify.post<{ Params: { shop: string } }>('/invites/decline', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = request.user;

    const shop = await Shop.findOne({
      where: { id: request.params.shop },
      attributes: ['id'],
    });
    if (!shop) {
      return reply.status(400).send({ message: 'Магазин не найден.' });
    }
    const coOwner = await ShopCoOwner.findOne({
      where: {
        shopId: shop.id,
        userId: user.id,
        status: 'pending',
      },
    });
    if (!coOwner) {
      return reply.status(400).send({ message: 'Приглашение не найдено или уже обработано.' });
    }
    coOwner.status = 'declined';
    await coOwner.save();
    return reply.send({ message: 'Приглашение отклонено.' });
  });
};

export default route;
