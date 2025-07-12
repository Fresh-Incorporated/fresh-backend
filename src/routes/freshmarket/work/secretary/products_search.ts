import { FastifyPluginAsync } from 'fastify';
import { Op } from 'sequelize';
import { User } from '../../../../models/User';
import { Shop } from '../../../../models/Shop';
import { Product } from '../../../../models/Product';
import { LocationCell } from '../../../../models/LocationCell';
import { Tag } from '../../../../models/Tag';

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

  fastify.get<{ Querystring: { id?: number; name?: string; cell?: string; limit?: number } }>('/products/search', async (request, reply) => {
    const where: any = {};
    const cellWhere: any = {};
    if (request.query.id !== undefined && request.query.id !== null) {
      where.id = request.query.id;
    }
    if (request.query.name !== undefined && request.query.name !== null) {
      where.name = { [Op.iLike]: `%${request.query.name}%` };
    }
    if (request.query.cell !== undefined && request.query.cell !== null) {
      cellWhere.letter = request.query.cell.split('-')[0];
      cellWhere.number = request.query.cell.split('-')[1];
    }
    const products = await Product.findAll({
      include: [
        { model: Shop, as: 'shop', attributes: ['id', 'name', 'icon'] },
        { model: LocationCell, as: 'cell', attributes: ['id', 'letter', 'number'], where: cellWhere },
        { model: Tag, as: 'tags', through: { attributes: [] } },
      ],
      limit: request.query.limit ? (request.query.limit < 1 || request.query.limit > 50 ? 5 : request.query.limit) : 5,
      order: [['id', 'DESC']],
      where,
    });
    return reply.status(200).send({ products });
  });
};

export default route;
