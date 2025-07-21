import { FastifyPluginAsync } from 'fastify';
import { Product } from '../../../../models/Product';
import { User } from '../../../../models/User';
import { LocationCell } from '../../../../models/LocationCell';
import { ShopCoOwner } from '../../../../models/ShopCoOwner';
import { Tag } from '../../../../models/Tag';
import { Order } from '../../../../models/Order';

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get('/', { preHandler: fastify.requireShopAccess }, async (request, reply) => {
    if (!request.shop) return reply.status(400).send({ message: 'Магазин не найден.' });
    const shop = await request.shop.reload({
      include: [
        {
          model: Product,
          as: 'products',
          include: [
            { model: LocationCell, as: 'refillCell' },
            { model: Tag, as: 'tags', through: { attributes: [] } }
          ],
          order: [['id', 'ASC']]
        },
        {
          model: ShopCoOwner,
          as: 'co_owners',
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'uuid', 'nickname']
            }
          ]
        }
      ]
    });
    return reply.send({ shop });
  });

  fastify.get('/sells', { preHandler: fastify.requireShopAccess }, async (request, reply) => {
    if (!request.shop) return reply.status(400).send({ message: 'Магазин не найден.' });
    const shop = await request.shop.reload({
      attributes: ['id'],
      include: [{ model: Product, as: 'products', attributes: ['id'] }]
    });
    const productIds: number[] = shop.products.map((p: any) => p.id);
    const orders = await Order.findAll({
      where: {
        paid: true,
        data: { $ne: null }
      },
      attributes: ['id', 'data', 'paid', 'createdAt'],
    });
    const salesHistory: Record<number, { productId: number; sales: any[] }> = {};
    for (const order of orders) {
      const orderProducts = (order.data as any).products || [];
      for (const p of orderProducts) {
        if (!productIds.includes(p.id)) continue;
        if (!salesHistory[p.id]) {
          salesHistory[p.id] = { productId: p.id, sales: [] };
        }
        salesHistory[p.id].sales.push({
          orderId: parseInt(order.id as any),
          count: p.count,
          price: p.price ?? 0,
          date: order.createdAt
        });
      }
    }
    reply.send({ productLastSells: Object.values(salesHistory) });
  });

  fastify.get('/sells/total', { preHandler: fastify.requireShopAccess }, async (request, reply) => {
    if (!request.shop) return reply.status(400).send({ message: 'Магазин не найден.' });
    const shop = await request.shop.reload({
      attributes: ['id'],
      include: [{ model: Product, as: 'products', attributes: ['id', 'name', 'color'], paranoid: false }]
    });
    const productIds: number[] = shop.products.map((p: any) => p.id);
    const orders = await Order.findAll({
      where: {
        paid: true,
        data: { $ne: null }
      },
      attributes: ['id', 'data', 'paid', 'createdAt'],
    });
    const salesHistory: Record<number, number> = {};
    const products: Record<number, Product | Object> = {};
    for (const order of orders) {
      const orderProducts = (order.data as any).products || [];
      for (const p of orderProducts) {
        if (!productIds.includes(p.id)) continue;
        if (!salesHistory[p.id]) {
          salesHistory[p.id] = p.count;
          const product = shop.products.find(pr => pr.id == p.id);
          if (product) {
            products[p.id] = product;
          }
        } else {
          salesHistory[p.id] += p.count;
        }
      }
    }

    reply.send({ sells: salesHistory, products });
  });
};

export default route;
