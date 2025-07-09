import { FastifyPluginAsync } from 'fastify';
import { SPWorlds } from 'spworlds';
import { notifyWorkers } from '../../../utils/notifyUtil';
import { Product } from '../../../models/Product';
import { Shop } from '../../../models/Shop';
import { Order } from '../../../models/Order';
import { OrderHistory } from '../../../models/OrderHistory';
import { Location } from '../../../models/Location';
import { BalanceHistory } from '../../../models/BalanceHistory';

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post('/new/instant', {
    preHandler: [fastify.requireAuth],
    config: {
      rateLimit: {
        timeWindow: '2 minute',
        max: 15
      }
    }
  }, async (request, reply) => {
    const { type, branch, products: rawProducts } = request.body as any;
    const { balance } = request.user!;
    const products = rawProducts.map((product: any) => ({ ...product, count: parseInt(product?.count) }));
    if (type !== 'branch') {
      return reply.status(400).send({ message: 'Сейчас доступна доставка только в филиалы!' });
    }
    if (products.length < 1) {
      return reply.status(400).send({ message: 'Корзина пуста!' });
    }
    const location = await Location.findOne({
      where: {
        id: branch,
        enabled: true,
        type: 'branch',
      },
      attributes: ['id']
    });
    if (location == null) {
      return reply.status(400).send({ message: 'Доставка в выбранный филиал недоступна!' });
    }
    const productIds = products.map((product: any) => product.id);
    const productRows = await Product.findAll({
      where: { id: productIds, verify_status: 1 },
      include: {
        model: Shop,
        as: 'shop',
      }
    });
    if (productRows.length !== products.length) {
      return reply.status(400).send({ message: 'Некоторые товары не найдены.' });
    }
    let totalPrice = 0;
    let totalSlots = 0;
    for (const product of products) {
      const productRow = productRows.find(row => row.id === product.id);
      if (!productRow) {
        return reply.status(400).send({ message: `Товар с ID ${product.id} не найден.` });
      }
      if (product.count > productRow.count) {
        return reply.status(400).send({ message: `Товара "${productRow.name}" недостаточно на складе.` });
      }
      if (product.count < 1) {
        return reply.status(400).send({ message: `Ты как 0 товара заказал гений?` });
      }
      totalPrice += productRow.price * product.count;
      totalSlots += productRow.slots_count * product.count;
    }
    if (totalSlots > 27) {
      return reply.status(500).send({ message: 'Слишком большой заказ! Мы временно не доставляем более 27 слотов.' });
    }
    if (balance < totalPrice) {
      if (totalPrice < 1728) {
        const spwApi = new SPWorlds({ id: process.env.SPW_ID || '', token: process.env.SPW_TOKEN || '' });
        const pong = await spwApi.ping();
        if (!pong) {
          return reply.status(500).send({ message: 'SPWorlds API не доступен. Попробуйте позже.' });
        }
        const items = [{
          name: 'Оплата заказа FreshMarket',
          comment: 'Остаток от пополнения будет переведён на баланс Fresh Inc.',
          count: 1,
          price: Math.ceil(totalPrice)
        }];
        const payment = await spwApi.initPayment({
          items,
          redirectUrl: (process.env.FRONTEND_URL || '') + '/bank/payment/spworlds/completed',
          webhookUrl: (process.env.BACKEND_URL || '') + '/bank/spworlds/payment',
          data: 'deposit_' + request.user!.id
        });
        return reply.status(400).send({ message: 'Недостаточно средств, пополните баланс.', url: payment.url });
      } else {
        return reply.status(400).send({ message: 'Недостаточно средств, пополните баланс.' });
      }
    }
    const transaction = await fastify.sequelize.transaction();
    try {
      for (const product of products) {
        const productRow = productRows.find(row => row.id === product.id);
        if (!productRow) continue;
        await Shop.increment({ balance: productRow.price * product.count * 0.9 }, {
          where: { id: productRow.shopId },
          transaction
        });
        product.price = productRow.price;
        await productRow.decrement({ count: product.count }, { transaction });
      }
      await request.user!.decrement({ balance: totalPrice }, { transaction });
      const order = await Order.create({
        customerId: request.user!.id,
        type,
        price: totalPrice,
        paid: true,
        branchId: branch,
        data: { products: products.map(({ id, count, price }: any) => ({ id, count, price })) },
      } as any, { transaction });
      await OrderHistory.create({
        action_type: 'created',
        orderId: order.id,
        userId: request.user!.id
      } as any, { transaction });
      await OrderHistory.create({
        action_type: 'paid',
        orderId: order.id,
        userId: request.user!.id
      } as any, { transaction });
      await BalanceHistory.create({
        action_type: 'freshmarket_order',
        message: 'Заказ на FreshMarket',
        userId: request.user!.id,
        value: -totalPrice,
      } as any, { transaction });
      await transaction.commit();
      notifyWorkers(fastify, 2, 'fm_logic_collect', 'Новый заказ', 'Соберите его как можно скорей!', '/cabinet/freshmarket/work/logic/collect');
      return reply.status(200).send({ message: 'Заказ оформлен.' });
    } catch (error: any) {
      console.error(error);
      await transaction.rollback();
      return reply.status(500).send({ message: 'Произошла ошибка при оформлении заказа.', error: error.message });
    }
  });
};

export default route;
