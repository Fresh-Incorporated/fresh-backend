import { FastifyPluginAsync } from 'fastify';
import { SPWorlds } from 'spworlds';
import { User } from '../../../models/User';
import { BalanceHistory } from '../../../models/BalanceHistory';

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get('/deposit', {
    preHandler: fastify.requireAuth,
    config: {
      rateLimit: {
        timeWindow: '5 minute',
        max: 5
      }
    }
  }, async (request, reply) => {
    const spwApi = new SPWorlds({ id: process.env.SPW_ID || '', token: process.env.SPW_TOKEN || '' });
    const pong = await spwApi.ping();
    if (!pong) {
      return reply.status(500).send({ message: 'SPWorlds API не доступен. Попробуйте позже.' });
    }
    const valueRaw = (request.query as any).value;
    const value = valueRaw !== undefined ? Number(valueRaw) : NaN;
    if (!value || value < 1 || value > 1728) {
      return reply.status(400).send({ message: 'Неверное значение.' });
    }
    const payment = await spwApi.initPayment({
      items: [
        {
          name: 'Пополнение баланса',
          count: 1,
          price: value,
          comment: 'Fresh Incorporated',
        }
      ],
      redirectUrl: (process.env.FRONTEND_URL || '') + '/bank/payment/spworlds/completed',
      webhookUrl: (process.env.BACKEND_URL || '') + '/bank/spworlds/payment',
      data: 'deposit_' + request.user!.id
    });
    return reply.status(200).send(payment);
  });

  fastify.post('/withdraw', {
    preHandler: fastify.requireAuth,
    config: {
      rateLimit: {
        timeWindow: '5 minute',
        max: 5
      }
    }
  }, async (request, reply) => {
    const spwApi = new SPWorlds({ id: process.env.SPW_ID || '', token: process.env.SPW_TOKEN || '' });
    const pong = await spwApi.ping();
    if (!pong) {
      return reply.status(500).send({ message: 'SPWorlds API не доступен. Попробуйте позже.' });
    }
    const { receiver, amount } = request.body as { receiver?: string; amount?: number | string };
    const amountNum = typeof amount === 'string' ? Number(amount) : amount;
    if (!receiver || !amountNum || amountNum < 1 || amountNum > 1728) {
      return reply.status(400).send({ message: 'Сумма должна быть больше 0 и меньше 1729.' });
    }
    try {
      await fastify.sequelize.transaction(async (t) => {
        const user = await User.findOne({
          where: { id: request.user!.id },
          attributes: ['id', 'balance'],
          lock: t.LOCK.UPDATE,
          transaction: t
        });
        if (!user) {
          throw new Error('Пользователь не найден.');
        }
        if (parseInt(user.balance as any) < amountNum) {
          throw new Error('Недостаточно средств.');
        }
        await User.update(
          { balance: (user.balance as any) - amountNum },
          { where: { id: user.id }, transaction: t }
        );
        await BalanceHistory.create({
          action_type: 'withdraw',
          message: 'Вывод средств на карту SPWorlds: ' + receiver,
          userId: user.id,
          value: -amountNum
        } as any, { transaction: t });
        const response = await spwApi.createTransaction({
          receiver: receiver,
          amount: amountNum,
          comment: 'Вывод средств Fresh Inc'
        });
        if (!response || (response as any).error) {
          throw new Error('Ошибка при создании транзакции в SPWorlds.');
        }
      });
      return reply.status(200).send({ message: 'Успешный вывод!' });
    } catch (err: any) {
      const message = ['Недостаточно средств.', 'Пользователь не найден.'].includes(err.message)
        ? err.message
        : 'Ошибка при выводе средств. Попробуйте позже.';
      return reply.status(400).send({ message });
    }
  });
};

export default route;
