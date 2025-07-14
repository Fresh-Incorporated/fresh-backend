import { FastifyPluginAsync } from 'fastify';
import { Op } from 'sequelize';
import { User } from '../../../../models/User';
import { Product } from '../../../../models/Product';
import { Shop } from '../../../../models/Shop';
import { Location } from '../../../../models/Location';
import { LocationCell } from '../../../../models/LocationCell';
import { Order } from '../../../../models/Order';
import { LocationCoordinate } from '../../../../models/LocationCoordinate';

const route: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.addHook('onRequest', async (request, reply) => {
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
      if (dbUser.fm_worker < 1) {
        return reply.status(403).send({ message: 'Недостаточно прав.' });
      }
      request.user = dbUser;
    } catch (err) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  fastify.get('/list/orders', async (request, reply) => {
    const orders = await Order.findAll({
      where: {
        status: {
          [Op.or]: [2, 3],
        },
      },
      include: [
        {
          model: User,
          as: 'currentWorker',
        },
        {
          model: LocationCell,
          as: 'deliverCell',
          include: [
            {
              model: Location,
              as: 'location',
            },
          ],
        },
        {
          model: LocationCell,
          as: 'branchCell',
          include: [
            {
              model: Location,
              as: 'location',
              include: [
                {
                  model: LocationCoordinate,
                  as: 'coordinates',
                },
              ],
            },
          ],
        },
      ],
    });

    const productIds = new Set<number>();
    for (const order of orders) {
      if (order.data && Array.isArray((order.data as any).products)) {
        for (const product of (order.data as any).products) {
          productIds.add(product.id);
        }
      }
    }

    const products = await Product.findAll({
      where: { id: Array.from(productIds) },
      include: [
        {
          model: Shop,
          as: 'shop',
          attributes: ['id', 'name', 'description', 'icon'],
        },
        {
          model: LocationCell,
          as: 'cell',
        },
      ],
      paranoid: false,
    });

    return reply.status(200).send({ orders, products });
  });
};

export default route;
