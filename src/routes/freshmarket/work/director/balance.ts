import { FastifyPluginAsync } from 'fastify';
import { Op } from 'sequelize';
import { User } from '../../../../models/User';
import { Order } from '../../../../models/Order';
import { Shop } from '../../../../models/Shop';
import { BalanceHistory } from '../../../../models/BalanceHistory';

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

  fastify.get('/balance', async (request, reply) => {
    const orders = await Order.findAll({
      where: { id: { [Op.gte]: 1 } },
      attributes: ['id', 'type', 'price', 'status', 'customerId'],
    });
    const users = await User.findAll({ attributes: ['id'] });
    const totalCommissionBalance = orders.reduce((acc: number, order: any) => acc + (order.price * 0.1), 0);
    let totalSpentOnShops = 0;
    for (const user of users) {
      const shopCount = await Shop.count({ where: { ownerId: user.id } });
      if (shopCount > 0) {
        let cost = 0;
        for (let i = 0; i < shopCount; i++) {
          cost += 16 + 64 * i;
        }
        totalSpentOnShops += cost;
      }
    }
    let totalSpentOnShopAdditionalSlots = -((await BalanceHistory.sum('value', { where: { action_type: 'freshmarket_pay' } })) || 0) - totalSpentOnShops;
    return reply.status(200).send({ totalCommissionBalance, totalSpentOnShops, totalSpentOnShopAdditionalSlots });
  });
};

export default route;
