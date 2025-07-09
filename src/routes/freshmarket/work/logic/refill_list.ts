import { FastifyPluginAsync } from 'fastify';
import { Op } from 'sequelize';
import { User } from '../../../../models/User';
import { Product } from '../../../../models/Product';
import { Location } from '../../../../models/Location';
import { LocationCell } from '../../../../models/LocationCell';

const route: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      const accessToken = request.cookies.access_token;
      if (!accessToken) {
        return reply.status(401).send({ error: 'Missing access token' });
      }
      const jwtUser = fastify.jwt.verify(accessToken) as { id: number };
      const dbUser = await User.findOne({
        where: { id: jwtUser.id },
        attributes: { exclude: ['updatedAt'] },
      });
      if (!dbUser) {
        return reply.status(400).send({ message: 'Пользователь не найден.' });
      }
      if (dbUser.fm_worker < 2) {
        return reply.status(403).send({ message: 'Недостаточно прав.' });
      }
      request.user = dbUser;
    } catch (err) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  fastify.get('/list/refill', async (request, reply) => {
    const products = await Product.findAll({
      where: {
        refill_status: {
          [Op.gte]: 2,
        },
      },
      include: [
        {
          model: User,
          as: 'currentRefiller',
        },
        {
          model: LocationCell,
          as: 'cell',
          include: [
            {
              model: Location,
              as: 'location',
            },
          ],
        },
        {
          model: LocationCell,
          as: 'refillCell',
          include: [
            {
              model: Location,
              as: 'location',
            },
          ],
        },
      ],
    });
    return reply.status(200).send(products);
  });
};

export default route;
