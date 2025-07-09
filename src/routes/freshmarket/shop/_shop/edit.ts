import { FastifyPluginAsync } from 'fastify';
import { uploadToS3 } from '../../../../utils/s3Util';
import { notifyWorkers } from '../../../../utils/notifyUtil';
import { Shop } from '../../../../models/Shop';
import { ShopHistory } from '../../../../models/ShopHistory';

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post<{ Querystring: {
      name?: string;
      tag?: string;
      description?: string;
    } }>('/edit', { preHandler: fastify.requireShopAccess }, async (request, reply) => {
    if (!request.shop) return reply.status(400).send({ message: 'Магазин не найден.' });
    request.assertShopPermission('edit_shop_info');
    const query = request.query;
    if (query.name && (query.name.length < 3 || query.name.length > 16)) {
      return reply.status(400).send({ message: 'Длина названия должна быть в пределах 3-16 символов.' });
    }
    if (query.tag) {
      if (query.tag.length < 3 || query.tag.length > 32) {
        return reply.status(400).send({ message: 'Длина тега магазина должна быть в пределах 3-32 символов.' });
      }
      if (!/^[a-zA-Z0-9]+$/.test(query.tag)) {
        return reply.status(400).send({ message: 'Тег магазина может содержать только английские буквы и цифры.' });
      }
      query.tag = query.tag.toLowerCase();
    }
    if (await Shop.findOne({ where: { tag: query.tag } }) && request.shop.tag !== query.tag) {
      return reply.status(400).send({ message: 'Тег магазина уже занят!' });
    }
    if (query.description && query.description.length > 240) {
      return reply.status(400).send({ message: 'Длина описания должна быть не более 240 символов.' });
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
      const changes: any = { verify_status: 0 };
      if (query.name && request.shop.name !== query.name) {
        changes.name = query.name;
      }
      if (query.description && request.shop.description !== query.description) {
        changes.description = query.description;
      }
      if (query.tag && request.shop.tag !== query.tag) {
        changes.tag = query.tag;
      }
      if (fileUrl !== process.env.DEFAULT_SHOP_ICON) {
        changes.icon = fileUrl;
      }
      const currentShop = await Shop.update(changes, {
        where: { id: request.shop.id }
      });
      await ShopHistory.create({
        action_type: 'edited',
        userId: request.user.id,
        shopId: request.shop.id,
        data: changes,
      } as any);
      await ShopHistory.create({
        action_type: 'recheck',
        userId: request.user.id,
        shopId: request.shop.id,
      } as any);
      notifyWorkers(fastify, 3, 'fm_secretary_shop', 'Новая проверка', 'Проверьте магазин', '/cabinet/freshmarket/work/secretary/verify/shops');
      return reply.status(200).send({
        message: 'Магазин успешно отправлен на проверку!',
        shop: currentShop,
      });
    } catch (err) {
      console.error(err);
      return reply.status(500).send({ message: 'Ошибка при изменении магазина.' });
    }
  });
};

export default route;
