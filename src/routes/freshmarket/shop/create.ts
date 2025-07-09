import { FastifyPluginAsync } from 'fastify';
import { uploadToS3 } from '../../../utils/s3Util';
import { notifyWorkers } from '../../../utils/notifyUtil';
import { Shop } from '../../../models/Shop';
import { ShopHistory } from '../../../models/ShopHistory';
import { BalanceHistory } from '../../../models/BalanceHistory';

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post<{ Querystring: { name: string, description: string } }>('/create', { preHandler: fastify.requireAuth }, async (request, reply) => {
    if (request.query.name.length < 3 || request.query.name.length > 16) {
      return reply.status(400).send({ message: 'Длинна названия должна быть в пределах 3-16 символов.' });
    }
    if (request.query.description.length > 240) {
      return reply.status(400).send({ message: 'Длинна описания должна быть не более 240 символов.' });
    }
    const shops_count = await Shop.count({ where: { ownerId: request.user!.id } });
    const price = 16 + 64 * shops_count;
    if (request.user!.balance < price) {
      return reply.status(402).send({ message: 'Недостаточно средств. Не хватает: ' + (price - request.user!.balance) });
    }
    let fileUrl = process.env.DEFAULT_SHOP_ICON;
    try {
      const buffer = await (request.body as any).icon.toBuffer();
      const file = {
        filename: (request.body as any).icon.filename,
        mimetype: (request.body as any).icon.mimetype,
        size: buffer.length,
        buffer: buffer,
      };
      if (file.size > 2 * 1024 * 1024) {
        return reply.status(400).send({ message: 'Иконка должна быть не более 2 МБ!' });
      }
      if (file) {
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];
        if (!allowedMimeTypes.includes(file.mimetype)) {
          return reply.status(400).send({ message: 'Допускаются только изображения форматов JPEG, JPG, PNG, SVG или WEBP.' });
        }
        fileUrl = await uploadToS3(file, process.env.S3_BUCKET_NAME as string, 'fresh/market/shop_icon', true);
      }
    } catch (err) {
      console.warn('Файл не был загружен, используется иконка по умолчанию.');
    }
    try {
      const newShop = await Shop.create({
        ownerId: request.user!.id,
        name: request.query.name,
        description: request.query.description,
        icon: fileUrl,
      } as any);
      await request.user!.decrement({ balance: price });
      await ShopHistory.create({
        action_type: 'created',
        userId: request.user!.id,
        shopId: newShop.id,
        data: {
          name: newShop.name,
          description: newShop.description,
          products_limit: newShop.products_limit,
        },
      } as any);
      await BalanceHistory.create({
        action_type: 'freshmarket_pay',
        message: 'Покупка магазина FreshMarket',
        userId: request.user!.id,
        value: -price,
      } as any);
      notifyWorkers(fastify, 3, 'fm_secretary_shop', 'Новая проверка', 'Проверьте магазин', '/cabinet/freshmarket/work/secretary/verify/shops');
      return reply.status(200).send({
        message: 'Магазин успешно создан.',
        shop: newShop,
      });
    } catch (err) {
      console.error(err);
      return reply.status(500).send({ message: 'Ошибка при создании магазина.' });
    }
  });
};

export default route;
