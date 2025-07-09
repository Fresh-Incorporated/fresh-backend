import { FastifyPluginAsync } from 'fastify';
import { Op } from 'sequelize';
import { User } from '../../models/User';

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get<{ Querystring: {
      search?: string;
    } }>('/', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { search = '' } = request.query;

    const users = await User.findAll({
      where: {
        nickname: {
          [Op.iLike]: `%${search}%`
        }
      },
      attributes: ['nickname', 'uuid'],
      limit: 10,
      order: [['nickname', 'ASC']]
    });

    return reply.status(200).send({ users });
  });
};

export default route;
