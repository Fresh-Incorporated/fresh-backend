import { FastifyPluginAsync } from 'fastify';
import { Op } from 'sequelize';
import { Order } from '../../../../models/Order';
import { OrderHistory } from '../../../../models/OrderHistory';
import { ProductHistory } from '../../../../models/ProductHistory';
import { User } from '../../../../models/User';
import { Salary } from '../../../../models/Salary';
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

  fastify.get('/salary/generate', async (request, reply) => {
    const lastCompleted = (await Salary.findOne({ limit: 1, order: [['completedAt', 'DESC']], attributes: ['completedAt'] })) || { completedAt: 0 };
    const ordersHistory = await OrderHistory.findAll({
      attributes: ['id', 'action_type', 'userId'],
      include: [
        {
          model: Order,
          as: 'order',
          attributes: ['id', 'type', 'price', 'status', 'customerId', 'createdAt'],
          where: { createdAt: { [Op.gt]: lastCompleted.completedAt } },
          required: true,
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'nickname', 'uuid', 'discordId'],
        },
      ],
    });
    const productRefills = await ProductHistory.findAll({
      where: { action_type: 'refill_completed', createdAt: { [Op.gt]: lastCompleted.completedAt } },
      attributes: ['id', 'action_type', 'userId', 'productId'],
      include: [
        { model: User, as: 'user', attributes: ['id', 'nickname', 'uuid', 'discordId'] },
      ],
    });
    let recordedOrders = new Set<number>();
    let totalSalary = 0;
    for (const orderHistory of ordersHistory as any[]) {
      if (!recordedOrders.has(orderHistory.order.id)) {
        totalSalary = totalSalary + (orderHistory.order.price * 0.1);
        recordedOrders.add(orderHistory.order.id);
      }
    }
    const salaries: any[] = [];
    for (const history of ordersHistory as any[]) {
      let salary;
      if (history.action_type === 'collect_finished' || history.action_type === 'deliver_finished') {
        salary = salaries.find(s => s.id === history.user.id);
        if (!salary) {
          salary = { id: history.user.id, pays: {} };
          salaries.push(salary);
        }
      }
      if (history.action_type === 'collect_finished') {
        const pay = history.order.price * 0.1 * 0.2;
        if (!salary.pays.logic) {
          salary.pays.logic = { pay };
        } else {
          salary.pays.logic.pay += pay;
        }
      } else if (history.action_type === 'deliver_finished') {
        const pay = history.order.price * 0.1 * 0.2;
        if (!salary.pays.deliver) {
          salary.pays.deliver = { pay };
        } else {
          salary.pays.deliver.pay += pay;
        }
      }
    }
    const refillWorkers: any[] = [];
    let sum = 0;
    for (const history of productRefills as any[]) {
      let refillWorker = refillWorkers.find(worker => worker.id === history.user.id);
      if (!refillWorker) {
        refillWorker = { id: history.user.id, count: 1 };
        sum++;
        refillWorkers.push(refillWorker);
      } else {
        refillWorker.count++;
        sum++;
      }
    }
    for (const refill of refillWorkers) {
      const pay = (refill.count / sum) * (totalSalary * 0.2);
      let salary = salaries.find(s => s.id === refill.id);
      if (!salary) {
        salary = { id: refill.id, pays: {} };
        salaries.push(salary);
      }
      if (!salary.pays.logic) {
        salary.pays.logic = { pay };
      } else {
        salary.pays.logic.pay += pay;
      }
    }
    return reply.status(200).send({ totalSalary, salaries, endDatetime: Date.now() });
  });

  fastify.post('/salary/submit', async (request, reply) => {
    const { salaries, endDatetime } = request.body as { salaries: any[]; endDatetime: number };
    const transaction = await (fastify.sequelize as any).transaction();
    try {
      const lastCompleted = (await Salary.findOne({ limit: 1, order: [['completedAt', 'DESC']], attributes: ['completedAt'] })) || { completedAt: 0 };
      let pays: Record<number, any> = {};
      await Promise.all(salaries.map(async (salary) => {
        const user = await User.findOne({ where: { id: salary.id } });
        const filteredPays = Object.fromEntries(Object.entries(salary.pays).filter(([role, obj]: [string, any]) => obj.pay !== 0));
        pays[user!.id] = filteredPays;
      }));
      await Salary.create({ createdAt: lastCompleted.completedAt, completedAt: new Date(endDatetime), data: { pays } } as any, { transaction });
      for (const userId of Object.keys(pays)) {
        const pay = pays[Number(userId)];
        const totalPay = Object.values(pay).reduce((sum: number, obj: any) => sum + obj.pay, 0);
        await BalanceHistory.create({ action_type: 'freshmarket_salary', message: 'Зарплата FreshMarket', userId: userId, value: totalPay } as any, { transaction });
        await User.increment({ balance: totalPay }, { where: { id: userId }, transaction });
      }
      await transaction.commit();
    } catch (e) {
      await transaction.rollback();
      return reply.status(500).send(e);
    }
    return reply.status(200).send({ message: 'Зарплата создана!' });
  });
};

export default route;
