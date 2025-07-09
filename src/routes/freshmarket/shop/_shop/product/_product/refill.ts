import { FastifyPluginAsync } from 'fastify';
import { Op, Sequelize } from 'sequelize';
import { notifyWorkers } from '../../../../../../utils/notifyUtil';
import { Location } from '../../../../../../models/Location';
import { LocationCell } from '../../../../../../models/LocationCell';
import { ProductHistory } from '../../../../../../models/ProductHistory';

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post('/refill', { preHandler: fastify.requireProductAccess }, async (request, reply) => {
    request.assertShopPermission('refill_products');
    const product = request.product;
    const user = request.user;
    if (!product) return reply.status(400).send({ message: 'Товар не найден.' });
    if (!user) return reply.status(400).send({ message: 'Пользователь не найден.' });
    if (product.verify_status !== 1) {
      return reply.status(400).send({ message: 'Товар не проверен' });
    }
    if (product.cellId == null || product.refill_status > 0) {
      return reply.status(400).send({ message: 'Товар уже пополняется' });
    }
    const cell = await LocationCell.findOne({
      where: {
        id: {
          [Op.notIn]: Sequelize.literal(
            `(SELECT DISTINCT "refillCellId" FROM "products" WHERE "refillCellId" IS NOT NULL)`
          ),
        },
      },
      include: [
        {
          model: Location,
          as: 'location',
          where: {
            type: 'refill',
            enabled: true,
          },
          attributes: { exclude: ['deletedAt', 'updatedAt', 'createdAt'] },
        },
      ],
      attributes: { exclude: ['locationId'] },
    });
    if (!cell) {
      return reply.status(400).send({ message: 'Все ячейки для пополнения заняты. Попробуйте позже' });
    }
    await product.update({
      refill_status: 1,
      refillCellId: cell.id,
    });
    await ProductHistory.create({
      action_type: 'refill_started',
      data: {
        cell: {
          id: cell.id,
          letter: cell.letter,
          number: cell.number,
          location: {
            id: cell.location.id,
            name: cell.location.name,
          },
        },
      },
      userId: user.id,
      productId: product.id,
    } as any);
    return reply.status(200).send({ message: 'Ячейка для пополнения выделена! ', cell });
  });

  fastify.post('/refill/end', { preHandler: fastify.requireProductAccess }, async (request, reply) => {
    request.assertShopPermission('refill_products');
    const product = request.product;
    const user = request.user;
    if (!product) return reply.status(400).send({ message: 'Товар не найден.' });
    if (!user) return reply.status(400).send({ message: 'Пользователь не найден.' });
    if (product.verify_status !== 1) {
      return reply.status(400).send({ message: 'Товар не проверен' });
    }
    if (product.refill_status === 0) {
      return reply.status(400).send({ message: 'Товар не пополняется' });
    }
    if (product.refill_status === 2) {
      return reply.status(400).send({ message: 'Товар уже пополнен' });
    }
    await product.update({ refill_status: 2 });
    await ProductHistory.create({
      action_type: 'refill_waiting',
      userId: user.id,
      productId: product.id,
    } as any);
    await notifyWorkers(fastify, 2, 'fm_logic_refill', 'Новое пополнение', 'Пополните товар как можно скорей!', '/cabinet/freshmarket/work/logic/refill');
    return reply.status(200).send({ message: 'Вы завершили пополнение! Ожидайте пока работники пополнят склад.' });
  });
};

export default route;
