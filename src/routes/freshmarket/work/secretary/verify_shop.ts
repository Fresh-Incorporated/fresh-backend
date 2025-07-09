import { FastifyPluginAsync } from 'fastify';
import { notifyUser } from '../../../../utils/notifyUtil';
import { User } from '../../../../models/User';
import { Shop } from '../../../../models/Shop';

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

  fastify.post<{ Params: { id: string } }>('/shop/:id/accept', async (request, reply) => {
    const shop = await Shop.findOne({ where: { id: request.params.id, verify_status: 0 } });
    if (!shop) {
      return reply.status(400).send({ message: 'Магазин не найден (Возможно уже проверен).' });
    }
    await shop.update({ verify_status: 1 });
    await notifyUser(fastify, shop.ownerId, `fm_accepted_shop_${shop.id}`, 'Магазин подтверждён', `Магазин ${shop.name} подтверждён`, `/cabinet/freshmarket/shop/${shop.id}`);
    return reply.status(200).send({ message: 'Магазин подтверждён' });
  });

  fastify.post<{ Params: { id: string } }>('/shop/:id/decline', async (request, reply) => {
    const shop = await Shop.findOne({ where: { id: request.params.id, verify_status: 0 } });
    if (!shop) {
      return reply.status(400).send({ message: 'Магазин не найден (Возможно уже проверен).' });
    }
    await shop.update({ verify_status: -1 });
    await notifyUser(fastify, shop.ownerId, `fm_declined_shop_${shop.id}`, 'Магазин отклонён', `Магазин ${shop.name} отклонён`, `/cabinet/freshmarket/shop/${shop.id}`);
    return reply.status(200).send({ message: 'Магазин отклонён' });
  });

  fastify.get('/shops', async (request, reply) => {
    const shops = await Shop.findAll({ where: { verify_status: 0 } });
    return reply.status(200).send(shops);
  });
};

export default route;
