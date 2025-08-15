import { FastifyPluginAsync } from 'fastify';
import { Op } from 'sequelize';
import { User } from '../../../models/User';
import { Shop } from '../../../models/Shop';
import { Product } from '../../../models/Product';
import { ShopCoOwner } from '../../../models/ShopCoOwner';
import { BalanceHistory } from '../../../models/BalanceHistory';
import { Order } from '../../../models/Order';
import { Location } from '../../../models/Location';
import { LocationCell } from '../../../models/LocationCell';
import { OrderHistory } from '../../../models/OrderHistory';
import { LocationImage } from '../../../models/LocationImage';
import { LocationCoordinate } from '../../../models/LocationCoordinate';
import { startOfDay, subDays, format } from 'date-fns';

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get('/', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = await User.findOne({
      where: { id: request.user!.id },
      include: [
        {
          model: ShopCoOwner,
          as: 'co_owns',
          required: false,
          where: { status: 'pending' },
          include: [
            {
              model: Shop,
              as: 'shop',
              attributes: ['id', 'icon', 'name', 'description']
            }
          ]
        }
      ],
      attributes: ['id', 'nickname', 'uuid', 'discordId', 'balance', 'bonuses', 'fm_worker', 'admin', 'createdAt'],
    });

    if (!user) {
      return reply.status(400).send({ message: 'Пользователь не найден..' });
    }
    return reply.status(200).send(user);
  });

  fastify.get('/shops', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = await User.findOne({
      where: { id: request.user!.id },
      attributes: ['id'],
    });
    if (!user) {
      return reply.status(400).send({ message: 'Пользователь не найден..' });
    }
    const shops = await Shop.findAll({
      where: {
        [Op.or]: [
          { ownerId: request.user!.id },
          { '$co_owners.userId$': request.user!.id, '$co_owners.status$': 'accepted' }
        ]
      },
      attributes: [
        'id', 'name', 'description', 'icon',
        'products_limit', 'verify_status',
        'balance', 'createdAt', 'tag'
      ],
      include: [
        {
          model: Product,
          as: 'products',
          attributes: [
            'id', 'name', 'description', 'icon',
            'stack_count', 'slots_count', 'price',
            'verify_status', 'refill_status',
            'count', 'createdAt'
          ],
        },
        {
          model: ShopCoOwner,
          as: 'co_owners',
          attributes: ['userId', 'status'],
          required: false
        }
      ],
      order: [['id', 'ASC']]
    });
    return reply.status(200).send(shops);
  });

  fastify.get('/orders', { preHandler: fastify.requireAuth }, async (request, reply) => {
    try {
      const user = await User.findOne({
        where: { id: request.user!.id },
        attributes: ['id'],
      });
      if (!user) {
        return reply.status(400).send({ message: 'Пользователь не найден.' });
      }
      const orders = await Order.findAll({
        where: { customerId: request.user!.id },
        attributes: ['id', 'type', 'world', 'x', 'y', 'z', 'data', 'price', 'status', 'paid', 'createdAt'],
        include: [
          { model: LocationCell, as: 'branchCell' },
          {
            model: Location,
            as: 'branch',
            attributes: { exclude: ['deletedAt'] },
            include: [
              { model: LocationImage, as: 'images', attributes: { exclude: ['createdAt', 'updatedAt'] } },
              { model: LocationCoordinate, as: 'coordinates', attributes: { exclude: ['createdAt', 'updatedAt'] } }
            ]
          },
          {
            model: OrderHistory,
            as: 'history',
            attributes: ['id', 'action_type', 'message', 'createdAt'],
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'nickname', 'discordId', 'uuid']
              }
            ]
          }
        ],
        limit: 15
      });
      const productIds = new Set<number>();
      const ordersWithProducts = orders.map(order => {
        const orderData = typeof order.data === 'object' ? order.data as { products?: { id: number }[] } : { products: [] };
        (orderData.products || []).forEach((product) => productIds.add(product.id));
        return { ...order.toJSON(), products: orderData.products };
      });
      const products = await Product.findAll({
        where: { id: Array.from(productIds) },
        include: [
          {
            model: Shop,
            as: 'shop',
            attributes: ['id', 'name', 'description', 'icon'],
          }
        ],
        attributes: ['id', 'name', 'description', 'icon', 'price', 'shopId'],
      });
      return reply.status(200).send({ orders: ordersWithProducts, products });
    } catch (error: any) {
      console.error(error);
      return reply.status(500).send({ message: 'Ошибка сервера', error: error.message });
    }
  });

  fastify.get<{ Querystring: { offset?: number; before?: string } }>('/history/balance', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { offset, before } = request.query;
    const user = await User.findOne({
      where: { id: request.user!.id },
      attributes: ['id'],
    });
    if (!user) {
      return reply.status(400).send({ message: 'Пользователь не найден..' });
    }
    const history = await BalanceHistory.findAll({
      where: {
        userId: request.user!.id,
        createdAt: {
          [Op.lte]: before ? new Date(before) : new Date(),
        }
      },
      attributes: ['id', 'action_type', 'message', 'value', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: 20,
      offset: offset,
    });
    return reply.status(200).send(history);
  });

  fastify.get('/history/balance/month', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = await User.findOne({
      where: { id: request.user!.id },
      attributes: ['id'],
    });
    if (!user) {
      return reply.status(400).send({ message: 'Пользователь не найден.' });
    }
    const thirtyDaysAgo = startOfDay(subDays(new Date(), 30));
    const history = await BalanceHistory.findAll({
      where: {
        userId: request.user!.id,
        createdAt: {
          [Op.gte]: thirtyDaysAgo
        }
      },
      attributes: ['value', 'createdAt'],
      order: [['createdAt', 'ASC']],
    });
    const result: Record<string, number> = {};
    for (const record of history) {
      const date = format(record.createdAt, 'yyyy-MM-dd');
      result[date] = (result[date] || 0) + record.value;
    }
    return reply.status(200).send(result);
  });
};

export default route;
