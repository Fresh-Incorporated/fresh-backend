import { FastifyPluginAsync } from 'fastify';
import { User } from '../../../../models/User';
import { Shop } from '../../../../models/Shop';
import { Product } from '../../../../models/Product';
import { Location } from '../../../../models/Location';
import { LocationCell } from '../../../../models/LocationCell';
import { ProductHistory } from '../../../../models/ProductHistory';
import { Tag } from '../../../../models/Tag';

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

  fastify.post<{ Params: { id: string }; Body: { message?: string } }>('/product/:id/accept', async (request, reply) => {
    const product = await Product.findOne({
      where: { id: request.params.id, verify_status: 0 },
      include: [
        { model: Shop, as: 'shop', where: { verify_status: 1 } },
        { model: LocationCell, as: 'cell' },
      ],
    });
    if (!product) {
      return reply.status(400).send({ message: 'Товар не найден (Возможно уже проверен).' });
    }
    if (!(product as any).cell) {
      return reply.status(400).send({ message: 'Не присвоена ячейка.' });
    }
    await product.update({ verify_status: 1 });
    await ProductHistory.create({ action_type: 'accepted', userId: (request as any).user.id, productId: product.id } as any);
    // await notifyUser(fastify, product.id, `fm_accepted_product_${product.id}`, 'Товар подтверждён', `Товар ${product.name} подтверждён`, `/cabinet`);
    return reply.status(200).send({ message: 'Товар подтверждён' });
  });

  fastify.post<{ Params: { id: string }; Body: { message?: string } }>('/product/:id/decline', async (request, reply) => {
    const product = await Product.findOne({
      where: { id: request.params.id, verify_status: 0 },
      include: [
        { model: Shop, as: 'shop', where: { verify_status: 1 } },
      ],
    });
    if (!product) {
      return reply.status(400).send({ message: 'Товар не найден (Возможно уже проверен).' });
    }
    await product.update({ verify_status: -1 });
    await ProductHistory.create({ action_type: 'declined', userId: (request as any).user.id, productId: product.id, message: request.body.message } as any);
    // await notifyUser(fastify, product.id, `fm_declined_product_${product.id}`, 'Товар отклонён', `Товар ${product.name} отклонён`, `/cabinet`);
    return reply.status(200).send({ message: 'Товар отклонён' });
  });

  fastify.get('/products', async (request, reply) => {
    const products = await Product.findAll({
      where: { verify_status: 0 },
      include: [
        { model: Shop, as: 'shop', where: { verify_status: 1 } },
        { model: LocationCell, as: 'cell', include: [{ model: Location, as: 'location' }] },
        { model: ProductHistory, as: 'history', include: [{ model: User, as: 'user' }] },
        { model: Tag, as: 'tags', through: { attributes: [] } },
      ],
    });
    return reply.status(200).send(products);
  });
};

export default route;
