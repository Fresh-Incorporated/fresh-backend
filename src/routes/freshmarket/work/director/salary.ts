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
    const percentages = { delivery: 0.3, logic: 0.45, secretary: 0.15, director: 0.1 };

    // Последняя завершённая выплата
    const lastCompleted =
        (await Salary.findOne({
          limit: 1,
          order: [['completedAt', 'DESC']],
          attributes: ['completedAt'],
        })) || { completedAt: 0 };

    // История заказов (с момента последней выплаты)
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

    // История пополнений
    const productRefills = await ProductHistory.findAll({
      where: { action_type: 'refill_completed', createdAt: { [Op.gt]: lastCompleted.completedAt } },
      attributes: ['id', 'action_type', 'userId', 'productId'],
      include: [{ model: User, as: 'user', attributes: ['id', 'nickname', 'uuid', 'discordId'] }],
    });

    // --- общий фонд зарплаты (10% от заказов) ---
    let recordedOrders = new Set<number>();
    let totalSalary = 0;
    for (const orderHistory of ordersHistory as any[]) {
      if (!recordedOrders.has(orderHistory.order.id)) {
        totalSalary += orderHistory.order.price * 0.1;
        recordedOrders.add(orderHistory.order.id);
      }
    }

    // --- распределение задач по пользователям ---
    const taskCounters: Record<number, { deliver: number; logic: number }> = {};

    for (const history of ordersHistory as any[]) {
      if (history.action_type === 'collect_finished' || history.action_type === 'deliver_finished') {
        if (!taskCounters[history.user.id]) {
          taskCounters[history.user.id] = { deliver: 0, logic: 0 };
        }

        if (history.action_type === 'collect_finished') {
          taskCounters[history.user.id].logic += 1;
        } else if (history.action_type === 'deliver_finished') {
          taskCounters[history.user.id].deliver += 1;
        }
      }
    }

    // --- общее количество задач по ролям ---
    let totalLogicTasks = 0;
    let totalDeliverTasks = 0;

    for (const userId in taskCounters) {
      totalLogicTasks += taskCounters[userId].logic;
      totalDeliverTasks += taskCounters[userId].deliver;
    }

    // --- распределение зарплаты ---
    const salaries: any[] = [];

    for (const userId in taskCounters) {
      const userTasks = taskCounters[userId];
      const salary: any = { id: Number(userId), pays: {} };

      if (userTasks.logic > 0 && totalLogicTasks > 0) {
        salary.pays.logic = {
          pay: (userTasks.logic / totalLogicTasks) * (totalSalary * (percentages.logic / 2)),
        };
      }

      if (userTasks.deliver > 0 && totalDeliverTasks > 0) {
        salary.pays.deliver = {
          pay: (userTasks.deliver / totalDeliverTasks) * (totalSalary * percentages.delivery),
        };
      }

      salaries.push(salary);
    }

    // --- распределение за пополнения (refill) ---
    const refillWorkers: any[] = [];
    let refillSum = 0;

    for (const history of productRefills as any[]) {
      let refillWorker = refillWorkers.find((worker) => worker.id === history.user.id);
      if (!refillWorker) {
        refillWorker = { id: history.user.id, count: 1 };
        refillWorkers.push(refillWorker);
      } else {
        refillWorker.count++;
      }
      refillSum++;
    }

    for (const refill of refillWorkers) {
      const pay = (refill.count / refillSum) * (totalSalary * (percentages.logic / 2));
      let salary = salaries.find((s) => s.id === refill.id);
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

    return reply.status(200).send({
      totalSalary,
      salaries,
      endDatetime: Date.now(),
      percentages,
    });
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
