import { FastifyPluginAsync } from 'fastify';
import { Op, literal } from 'sequelize';
import { Product } from '../../models/Product';
import { Shop } from '../../models/Shop';
import { Tag } from '../../models/Tag';

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get('/products', async (request, reply) => {
    const query = request.query as any;
    const offset = query.offset || 0;
    let defaultQuery: any = {
      offset: offset,
      limit: 30,
      where: {
        verify_status: 1,
        count: {
          [Op.gt]: 0
        },
        [Op.and]: [],
        enabled: true,
        cellId: { [Op.not]: null }
      },
      include: [
        {
          model: Shop,
          as: 'shop',
          attributes: ['id', 'name', 'icon', 'tag'],
          where: {
            verify_status: 1,
            enabled: true
          },
        },
        {
          model: Tag,
          as: 'tags',
          through: { attributes: [] }
        }
      ],
      order: [],
      attributes: ['id', 'name', 'description', 'icon', 'stack_count', 'slots_count', 'price', 'count', 'shopId'],
    };
    if (query.sort !== undefined) {
      switch (query.sort) {
        case 'cheap':
          defaultQuery.order.push(['price', 'ASC']);
          break;
        case 'expensive':
          defaultQuery.order.push(['price', 'DESC']);
          break;
      }
    }
    if (query.tags !== undefined) {
      const tagIds = query.tags
        .split('_')
        .map((id: string) => parseInt(id))
        .filter((id: number) => !isNaN(id));
      if (tagIds.length > 0) {
        const tagIdList = tagIds.join(',');
        defaultQuery.where[Op.and].push(
          literal(`EXISTS (
            SELECT 1 FROM product_tags pt
            WHERE pt.product_id = "Product".id AND pt.tag_id IN (${tagIdList})
          )`) as unknown as any
        );
      }
    }
    if (query.search !== undefined) {
      defaultQuery.where[Op.and].push({
        [Op.or]: [
          { name: { [Op.iLike]: `%${query.search}%` } },
          { description: { [Op.iLike]: `%${query.search}%` } },
          { '$shop.name$': { [Op.iLike]: `%${query.search}%` } },
        ],
      });
    }
    if (query.seed !== undefined) {
      defaultQuery.order.push([
        literal(`MD5(CONCAT("Product"."id", '${query.seed}'))`) as unknown as any,
        'ASC',
      ]);
    }
    const products = await Product.findAll(defaultQuery);
    return reply.status(200).send(products);
  });
};

export default route;
