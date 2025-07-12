import { FastifyPluginAsync } from 'fastify';
import { Op } from 'sequelize';
import { Order } from '../../../../models/Order';
import { Shop } from '../../../../models/Shop';
import { Product } from '../../../../models/Product';
import { User } from '../../../../models/User';
import { Location } from '../../../../models/Location';
import { LocationCell } from '../../../../models/LocationCell';

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      const accessToken = request.cookies.access_token;
      if (!accessToken) {
        return reply.status(401).send({ error: 'Missing access token' });
      }
      const jwtUser = fastify.jwt.verify(accessToken) as { id: number };
      const user = await User.findOne({
        where: { id: jwtUser.id },
        attributes: { exclude: ['updatedAt'] },
      });
      if (!user) {
        return reply.status(400).send({ message: 'Пользователь не найден.' });
      }
      if (user.fm_worker < 4) {
        return reply.status(403).send({ message: 'Недостаточно прав.' });
      }
      (request as any).user = user;
    } catch (err) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  fastify.get('/stats', async (request, reply) => {
    const storages = await Location.findAll({ where: { type: 'storage' }, attributes: ['id'] });
    const totalOrders = await Order.count();
    const totalCells = await LocationCell.count({ where: { locationId: { [Op.in]: storages.map(s => s.id) } } });
    const usedCells = await Product.count({ where: { cellId: { [Op.not]: null } } } as any);
    const shopCells = await Shop.sum('products_limit');
    return reply.status(200).send({ totalOrders, totalCells, usedCells, shopCells });
  });
};

export default route;
