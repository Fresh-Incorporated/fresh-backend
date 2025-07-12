import { FastifyPluginAsync } from 'fastify';
import { ShopHistory } from '../../../../models/ShopHistory';
import { BalanceHistory } from '../../../../models/BalanceHistory';

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post('/withdraw', { preHandler: fastify.requireShopAccess }, async (request, reply) => {
    if (!request.isOwner) return reply.status(400).send({ message: 'Недостаточно прав.' });
    const value = Math.floor(request.shop!.balance);
    if (value < 10) {
      return reply.status(400).send({ message: 'Минимальная сумма вывода: 10 АР' });
    }
    await request.shop!.decrement({ balance: value });
    await request.user!.increment({ balance: value });
    await ShopHistory.create({
      action_type: 'withdraw',
      userId: request.user!.id,
      shopId: request.shop!.id,
      data: { value },
    } as any);
    await BalanceHistory.create({
      action_type: 'freshmarket_shop_withdraw',
      message: `Вывод средств из магазина ${request.shop!.name} [${request.shop!.id}]`,
      userId: request.user!.id,
      value: value
    } as any);
    return reply.status(200).send({ message: 'Средства магазина переведены на ваш аккаунт!' });
  });
};

export default route;
