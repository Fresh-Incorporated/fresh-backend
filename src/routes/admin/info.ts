import { FastifyPluginAsync } from 'fastify';
import { Op, fn, literal } from 'sequelize';
import { format, subDays } from 'date-fns';
import { User } from '../../models/User';
import { Shop } from '../../models/Shop';
import { Order } from '../../models/Order';
import { Location } from '../../models/Location';
import { BalanceHistory } from '../../models/BalanceHistory';

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get('/stats', { preHandler: fastify.requireAuth }, async (request, reply) => {
    if (!request.user?.admin) return reply.status(403).send({ message: 'Недостаточно прав.' });

    // Кол-во пользователей
    const totalUsers = await User.count();

    // Получаем всех пользователей и магазины одним запросом
    const [users, shops] = await Promise.all([
      User.findAll({ attributes: ['id', 'balance'] }),
      Shop.findAll({ attributes: ['id', 'balance', 'ownerId'] })
    ]);

    // Общие балансы
    const totalBalanceUsers = users.reduce((sum, u) => sum + u.balance, 0);
    const totalBalanceShops = shops.reduce((sum, s) => sum + s.balance, 0);

    // Расходы на магазины (по прогрессии)
    const shopCountsByUser: Record<number, number> = shops.reduce((acc, shop) => {
      acc[shop.ownerId] = (acc[shop.ownerId] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    let totalSpentOnShops = 0;
    for (const userId in shopCountsByUser) {
      const count = shopCountsByUser[userId];
      const cost = count * 16 + (count * (count - 1)) * 64 / 2;
      totalSpentOnShops += cost;
    }

    let totalSpentOnShopAdditionalSlots = -(await BalanceHistory.sum('value', {
      where: {
        action_type: 'freshmarket_pay'
      }
    })) - totalSpentOnShops;

    // Регистрации за последние 90 дней
    const today = new Date();
    const startDate = subDays(today, 89); // включая сегодня

    const dateLiteral = literal('DATE("createdAt")') as unknown as string;

    const registrationsRaw = await User.findAll({
      attributes: [
        [dateLiteral, 'date'],
        [fn('COUNT', '*'), 'count']
      ],
      where: {
        createdAt: {
          [Op.gte]: startDate
        }
      },
      group: [dateLiteral],
      order: [[dateLiteral, 'ASC']],
      raw: true
    });

    const registrationsMap: Record<string, number> = {};
    for (const r of registrationsRaw as any[]) {
      registrationsMap[r.date] = Number(r.count);
    }

    const registrations: { date: string; count: number }[] = [];
    for (let i = 0; i < 90; i++) {
      const date = format(subDays(today, 89 - i), 'yyyy-MM-dd');
      registrations.push({
        date,
        count: registrationsMap[date] || 0
      });
    }

    // Заказы за последние 90 дней (всего и по филиалам)
    const ordersRaw = await Order.findAll({
      attributes: [
        [dateLiteral, 'date'],
        [fn('COUNT', '*'), 'count'],
        'branchId'
      ],
      where: {
        createdAt: {
          [Op.gte]: startDate
        }
      },
      group: [dateLiteral, 'branchId'],
      order: [[dateLiteral, 'ASC']],
      raw: true
    });

    // Получаем список филиалов
    const branches = await Location.findAll({
      where: { type: 'branch' },
      attributes: ['id', 'name'],
      raw: true
    });

    const branchMap: Record<number, string> = {};
    for (const branch of branches as any[]) {
      branchMap[branch.id] = branch.name;
    }

    const ordersTotalMap: Record<string, number> = {};
    const ordersByBranchMap: Record<number, Record<string, number>> = {};

    for (const o of ordersRaw as any[]) {
      const date = o.date;
      const count = Number(o.count);
      const branchId = o.branchId;
      // Общие заказы по дням
      ordersTotalMap[date] = (ordersTotalMap[date] || 0) + count;
      // Заказы по филиалу
      if (branchId) {
        if (!ordersByBranchMap[branchId]) ordersByBranchMap[branchId] = {};
        ordersByBranchMap[branchId][date] = (ordersByBranchMap[branchId][date] || 0) + count;
      }
    }

    const orders: { date: string; total: number; branches: Record<string, number> }[] = [];
    for (let i = 0; i < 90; i++) {
      const date = format(subDays(today, 89 - i), 'yyyy-MM-dd');
      const entry: { date: string; total: number; branches: Record<string, number> } = {
        date,
        total: ordersTotalMap[date] || 0,
        branches: {}
      };
      for (const branchId in branchMap) {
        entry.branches[branchMap[branchId]] = ordersByBranchMap[branchId]?.[date] || 0;
      }
      orders.push(entry);
    }

    return reply.status(200).send({
      totalSpentOnShops,
      totalSpentOnShopAdditionalSlots,
      totalBalanceUsers,
      totalBalanceShops,
      totalUsers,
      registrations,
      orders
    });
  });
};

export default route;