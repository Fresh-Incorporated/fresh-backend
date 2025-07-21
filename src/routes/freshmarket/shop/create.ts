import { FastifyPluginAsync } from 'fastify';
import { uploadToS3 } from '../../../utils/s3Util';
import { notifyWorkers } from '../../../utils/notifyUtil';
import { Shop } from '../../../models/Shop';
import { ShopHistory } from '../../../models/ShopHistory';
import { BalanceHistory } from '../../../models/BalanceHistory';
import { User } from '../../../models/User';

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
      await fastify.sequelize.transaction(async (t) => {
        // Блокируем пользователя для атомарности
        const user = await User.findOne({
          where: { id: request.user!.id },
          attributes: ['id', 'balance'],
          lock: t.LOCK.UPDATE,
          transaction: t
        });
        if (!user) {
          throw new Error('Пользователь не найден.');
        }
        if (user.balance < price) {
          throw new Error('Недостаточно средств. Не хватает: ' + (price - user.balance));
        }
        // Списываем баланс
        const [updatedRows] = await User.update(
          { balance: user.balance - price },
          { where: { id: user.id, balance: user.balance }, transaction: t }
        );
        if (updatedRows !== 1) {
          throw new Error('Ошибка при списании средств. Попробуйте ещё раз.');
        }
        // Создаём магазин
        const newShop = await Shop.create({
          ownerId: user.id,
          name: request.query.name,
          description: request.query.description,
          icon: fileUrl,
        } as any, { transaction: t });
        // История магазина
        await ShopHistory.create({
          action_type: 'created',
          userId: user.id,
          shopId: newShop.id,
          data: {
            name: newShop.name,
            description: newShop.description,
            products_limit: newShop.products_limit,
          },
        } as any, { transaction: t });
        // История баланса
        await BalanceHistory.create({
          action_type: 'freshmarket_pay',
          message: 'Покупка магазина FreshMarket',
          userId: user.id,
          value: -price,
        } as any, { transaction: t });
        // Уведомление вне транзакции (после коммита)
        t.afterCommit(() => {
          notifyWorkers(fastify, 3, 'Новая проверка', 'Проверьте магазин', '/cabinet/freshmarket/work/secretary/verify/shops');
        });
        // Ответ
        reply.status(200).send({
          message: 'Магазин успешно создан.',
          shop: newShop,
        });
      });
    } catch (err: any) {
      const message = err.message && err.message.startsWith('Недостаточно средств')
        ? err.message
        : 'Ошибка при создании магазина.';
      return reply.status(message.startsWith('Недостаточно средств') ? 402 : 500).send({ message });
    }
  });
};

export default route;
