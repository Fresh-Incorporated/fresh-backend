import { FastifyPluginAsync } from 'fastify';
import { Op } from 'sequelize';
import { User } from '../../../../models/User';
import { Shop } from '../../../../models/Shop';
import { ShopCoOwner } from '../../../../models/ShopCoOwner';
import { Product } from '../../../../models/Product';

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      const accessToken = request.cookies.access_token;
      if (!accessToken) {
        return reply.status(401).send({ error: 'Missing access token' });
      }
      const jwtUser = fastify.jwt.verify(accessToken) as { id: number };
      const user = await User.findOne({ where: { id: jwtUser.id }, attributes: { exclude: ['updatedAt'] } });
      if (!user) {
        return reply.status(400).send({ message: 'Пользователь не найден.' });
      }
      if (user.fm_worker < 3) {
        return reply.status(403).send({ message: 'Недостаточно прав.' });
      }
      (request as any).user = user;
    } catch (err) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  fastify.get<{ Querystring: { id?: number; tag?: string; name?: string; limit?: number } }>('/shops/search', async (request, reply) => {
    const where: any = {};
    if (request.query.id !== undefined && request.query.id !== null) {
      where.id = request.query.id;
    }
    if (request.query.tag !== undefined && request.query.tag !== null) {
      where.tag = request.query.tag;
    }
    if (request.query.name !== undefined && request.query.name !== null) {
      where.name = { [Op.iLike]: `%${request.query.name}%` };
    }
    const shops = await Shop.findAll({
      include: [
        { model: User, as: 'owner', attributes: ['id', 'uuid', 'nickname'] },
        { model: ShopCoOwner, as: 'co_owners', include: [{ model: User, as: 'user', attributes: ['id', 'uuid', 'nickname'] }] },
        { model: Product, as: 'products', attributes: ['id', 'icon', 'name'] },
      ],
      limit: request.query.limit ? (request.query.limit < 1 || request.query.limit > 50 ? 5 : request.query.limit) : 5,
      order: [['id', 'DESC']],
      where,
    });
    return reply.status(200).send({ shops });
  });
};

export default route;
