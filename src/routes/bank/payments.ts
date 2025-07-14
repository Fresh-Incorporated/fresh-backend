import { FastifyPluginAsync } from 'fastify';
import { SPWorlds } from 'spworlds';
import { User } from '../../models/User';
import { BalanceHistory } from '../../models/BalanceHistory';

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post<{ Body: { data: string; amount: number } }>('/spworlds/payment', async (request, reply) => {
    const spwApi = new SPWorlds({ id: process.env.SPW_ID || '', token: process.env.SPW_TOKEN || '' });
    let hashHeader = request.headers['x-body-hash'];
    if (Array.isArray(hashHeader)) hashHeader = hashHeader[0];
    const isValid = spwApi.validateHash(request.body as object, hashHeader || '');
    if (!isValid) {
      return reply.status(400).send({ message: 'Ошибка проверки цифровой подписи.' });
    }
    const { data, amount } = request.body;
    // const type = data.split('_')[0]; // For updates [deposit]
    const id = data.split('_')[1];
    await User.increment({ balance: amount }, {
      where: { id: id }
    });
    await BalanceHistory.create({
      action_type: 'deposit',
      message: 'Пополнение средств из SPWorlds',
      userId: id,
      value: amount
    } as any);
    return reply.status(200).send({ success: true });
  });
};

export default route;
