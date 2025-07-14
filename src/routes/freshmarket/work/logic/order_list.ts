import { FastifyPluginAsync } from 'fastify';
import { Op } from 'sequelize';
import { User } from '../../../../models/User';
import { Product } from '../../../../models/Product';
import { Shop } from '../../../../models/Shop';
import { Location } from '../../../../models/Location';
import { LocationCell } from '../../../../models/LocationCell';
import { Order } from '../../../../models/Order';

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
      if (dbUser.fm_worker < 2) {
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
          [Op.lte]: 1,
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
      ],
    });

    // Сбор уникальных productId из заказов
    const productIds = new Set<number>();
    const ordersWithProducts = orders.map(order => {
      const orderData = typeof order.data === 'object' ? order.data as { products: { id: number }[] } : { products: [] };
      orderData.products.forEach(product => productIds.add(product.id));
      const object = { ...order.toJSON(), products: orderData.products };
      if ('data' in object) {
        delete (object as any).data;
      }
      return object;
    });

    // Получение продуктов по уникальным productId
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

    return reply.status(200).send({ orders: ordersWithProducts, products });
  });
};

export default route;
