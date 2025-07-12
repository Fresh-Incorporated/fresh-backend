import { FastifyPluginAsync } from 'fastify';
import { uploadToS3 } from '../../../../../../utils/s3Util';
import { Product } from '../../../../../../models/Product';
import { ProductHistory } from '../../../../../../models/ProductHistory';
import { Tag } from '../../../../../../models/Tag';
import { User } from '../../../../../../models/User';

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.addHook<{ Params: { product?: string } }>('onRequest', async (request, reply) => {
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
      const product = await Product.findOne({ where: { id: request.params.product } });
      if (!product) {
        return reply.status(400).send({ message: 'Товар не найден' });
      }
      (request as any).user = user;
      (request as any).product = product;
    } catch (err) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  fastify.post<{ Querystring: { name?: string; count?: number; description?: string; price?: string; tags?: string }; Body: any }>('/edit', async (request, reply) => {
    const product = request.product;
    const user = request.user;
    if (product.refill_status !== 0) {
      return reply.status(400).send({ message: 'Нельзя изменить товар который пополняется. ' });
    }
    if (request.query.name && (request.query.name.length < 3 || request.query.name.length > 24)) {
      return reply.status(400).send({ message: 'Длина названия должна быть в пределах 3-24 символов.' });
    }
    if (request.query.count && (request.query.count < 1 || request.query.count > 10000)) {
      return reply.status(400).send({ message: 'Кол-во товара должно быть в пределах 1-10000 шт.' });
    }
    if (request.query.description && (request.query.description.length > 240)) {
      return reply.status(400).send({ message: 'Длина описания должна быть не более 240 символов.' });
    }
    if (request.query.price && (parseFloat(request.query.price) < 0.01 || parseFloat(request.query.price) > 1728)) {
      return reply.status(400).send({ message: 'Цена товара должна быть от 0.01 до 1728.' });
    }
    let tags: Tag[] | null = null;
    if (request.query.tags) {
      if (request.query.tags.split('_').length > 3) {
        return reply.status(400).send({ message: 'Количество тегов должно быть не более 3х.' });
      } else {
        tags = await Tag.findAll({ where: { id: request.query.tags.split('_') } });
        if (tags.length !== request.query.tags.split('_').length) {
          return reply.status(400).send({ message: 'Некоторые теги не найдены. (Ты че, хакер?)' });
        }
      }
    }
    let fileUrl = process.env.DEFAULT_SHOP_ICON;
    try {
      if (request.body && (request.body as any).icon) {
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
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];
        if (!allowedMimeTypes.includes(file.mimetype)) {
          return reply.status(400).send({ message: 'Допускаются только изображения форматов JPEG, JPG, PNG, SVG или WEBP.' });
        }
        fileUrl = await uploadToS3(file, process.env.S3_BUCKET_NAME!, 'fresh/market/shop_icon', true);
      }
    } catch (err) {
      console.warn('Файл не был загружен, используется иконка по умолчанию.');
    }
    try {
      const changes: any = {};
      let tagsChanged = false;
      if (request.query.name && product.name !== request.query.name) {
        changes.name = request.query.name;
      }
      if (request.query.count && product.count !== request.query.count) {
        changes.count = request.query.count;
      }
      if (request.query.description && product.description !== request.query.description) {
        changes.description = request.query.description;
      }
      if (fileUrl !== process.env.DEFAULT_SHOP_ICON) {
        changes.icon = fileUrl;
      }
      if (tags && tags.length > 0) {
        await (product as any).setTags(tags.map(tag => tag.id));
        tagsChanged = true;
      }
      if (request.query.price && product.price !== parseFloat(request.query.price)) {
        changes.price = parseFloat(request.query.price).toFixed(2);
      }
      await Product.update(changes, { where: { id: product.id } });
      const historyChanges = { ...changes };
      if (tagsChanged && tags) {
        historyChanges.tags = tags.map(tag => tag.name);
      }
      await ProductHistory.create({
        action_type: 'edited',
        userId: user.id,
        productId: product.id,
        data: historyChanges,
      } as any);
      return reply.status(200).send({ message: 'Товар изменён!' });
    } catch (err) {
      console.error(err);
      return reply.status(500).send({ message: 'Ошибка при изменении товара.' });
    }
  });
};

export default route;
