import { FastifyPluginAsync } from 'fastify';
import { Product } from '../../../models/Product';
import { Shop } from '../../../models/Shop';
import { User } from '../../../models/User';
import { ShopCoOwner } from '../../../models/ShopCoOwner';
import { Tag } from '../../../models/Tag';

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get<{ Querystring: { tag: string } }>('/info', async (request, reply) => {
    const query = request.query;
    const shop = await Shop.findOne({
      where: {
        tag: query.tag,
        enabled: true
      },
      attributes: ['id', 'name', 'description', 'tag', 'icon', 'verify_status', 'ownerId'],
      include: [
        {
          model: Product,
          as: 'products',
          where: {
            verify_status: 1,
            enabled: true
          },
          include: [
            {
              model: Tag,
              as: 'tags',
              through: { attributes: [] }
            }
          ],
          attributes: ['id', 'name', 'description', 'icon', 'stack_count', 'slots_count', 'price', 'count'],
        },
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'nickname', 'uuid']
        },
        {
          model: ShopCoOwner,
          as: 'co_owners',
          attributes: ['id', 'status', 'userId'],
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'nickname', 'uuid']
            }
          ]
        }
      ]
    });
    if (!shop) {
      return reply.status(400).send({ message: 'Магазин не найден!' });
    }
    return reply.status(200).send(shop);
  });
};

export default route;
