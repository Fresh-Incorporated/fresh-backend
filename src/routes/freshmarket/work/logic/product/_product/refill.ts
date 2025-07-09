import { FastifyPluginAsync } from 'fastify';
import { notifyUser } from '../../../../../../utils/notifyUtil';
import { User } from '../../../../../../models/User';
import { Product } from '../../../../../../models/Product';
import { Location } from '../../../../../../models/Location';
import { LocationCell } from '../../../../../../models/LocationCell';
import { Shop } from '../../../../../../models/Shop';
import { ProductHistory } from '../../../../../../models/ProductHistory';

interface Params {
  product: string;
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
      const product = await Product.findOne({
        where: { id: request.params.product },
        include: [
          {
            model: LocationCell,
            as: 'cell',
            include: [{ model: Location, as: 'location' }],
          },
          {
            model: Shop,
            as: 'shop',
            include: [{ model: User, as: 'owner' }],
          },
        ],
      });
      if (!product) {
        return reply.status(400).send({ message: 'Товар не найден.' });
      }
      request.product = product;
    } catch (err) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  fastify.post<{ Params: Params }>('/refill', async (request, reply) => {
    const product = request.product;
    const user = request.user;
    if (!product || !user) {
      return reply.status(400).send({ message: 'Не удалось получить пользователя или товар.' });
    }
    if (product.refill_status !== 2) {
      return reply.status(400).send({ message: 'Товар недоступен (Возможно уже пополняется другим работником)' });
    }
    await product.update({
      refill_status: 3,
      currentRefillerId: user.id,
    });
    await ProductHistory.create({
      action_type: 'refill_picked',
      userId: user.id,
      productId: product.id,
    } as any);
    return reply.status(200).send({ product, message: 'Задача на пополнение товара принята!' });
  });

  fastify.post<{ Params: Params; Body: { add?: number; message?: string } }>('/refill/end', async (request, reply) => {
    const product = request.product;
    const user = request.user;
    const { add, message } = request.body;
    if (!product || !user) {
      return reply.status(400).send({ message: 'Не удалось получить пользователя или товар.' });
    }
    if (product.refill_status !== 3) {
      return reply.status(400).send({ message: 'Товар недоступен (Возможно уже пополняется другим работником)' });
    }
    await product.increment({ count: add || 0 });
    await product.update({
      refill_status: 0,
      refillCellId: null,
      currentRefillerId: null,
    });
    await ProductHistory.create({
      action_type: 'refill_completed',
      data: { count: add },
      message: message,
      userId: user.id,
      productId: product.id,
    } as any);
    await notifyUser(
      fastify,
      product.shop.ownerId,
      'fm_refill_' + product.id,
      'Пополнение товара',
      'Товар ' + product.name + ' пополнен на ' + add,
      '/cabinet/freshmarket/shop/' + product.shop.id
    );
    return reply.status(200).send({ message: `Товар пополнен на ${add || 0}` });
  });
};

export default route;
