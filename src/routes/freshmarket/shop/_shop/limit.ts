import { FastifyPluginAsync } from 'fastify';
import { User } from '../../../../models/User';
import { ShopHistory } from '../../../../models/ShopHistory';
import { BalanceHistory } from '../../../../models/BalanceHistory';

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post<{ Body: { count: number } }>('/limit/increase', { preHandler: fastify.requireShopAccess }, async (request, reply) => {
    const count = request.body.count;
    if (!count || count <= 0 || count > 100) {
      return reply.status(400).send({ message: 'Неверное количество.' });
    }
    if (!request.isOwner) return reply.status(400).send({ message: 'Недостаточно прав.' });
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
        const current_limit = request.shop!.products_limit;
        if (current_limit + count > 25) {
          throw new Error('На данный момент максимальный лимит — 25.');
        }
        const price = Math.ceil(20 * count * (1 - 0.15 * Math.log10(count + 1)));
        if (user.balance < price) {
          throw new Error('Недостаточно средств, пополните баланс.');
        }
        await request.shop!.increment({ products_limit: count }, { transaction: t });
        await User.update(
          { balance: user.balance - price },
          { where: { id: user.id }, transaction: t }
        );
        await ShopHistory.create({
          action_type: 'limit_increase',
          userId: user.id,
          shopId: request.shop!.id,
          data: { count }
        } as any, { transaction: t });
        await BalanceHistory.create({
          action_type: 'freshmarket_pay',
          message: `Увеличение лимита магазина ${request.shop!.name} [${request.shop!.id}]`,
          userId: user.id,
          value: -price
        } as any, { transaction: t });
      });
      return reply.status(200).send({ message: 'Лимит магазина увеличен!' });
    } catch (err: any) {
      return reply.status(400).send({ message: err.message || 'Ошибка при увеличении лимита.' });
    }
  });
};

export default route;
