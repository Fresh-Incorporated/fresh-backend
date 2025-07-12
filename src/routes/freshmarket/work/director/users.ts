import { FastifyPluginAsync } from 'fastify';
import { Op } from 'sequelize';
import { User } from '../../../../models/User';

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

  fastify.get('/users/workers', async (request, reply) => {
    const users = await User.findAll({ where: { fm_worker: { [Op.gt]: 0 } } });
    return reply.status(200).send({ users });
  });

  fastify.post<{ Body: { ids: number[] } }>('/users/list', async (request, reply) => {
    const users = await User.findAll({ where: { id: { [Op.in]: request.body.ids } } });
    return reply.status(200).send({ users });
  });
};

export default route;
