import { FastifyPluginAsync } from 'fastify';
import { Op, Sequelize } from 'sequelize';
import { uploadToS3 } from '../../../../../utils/s3Util';
import { notifyWorkers } from '../../../../../utils/notifyUtil';
import { Product } from '../../../../../models/Product';
import { Location } from '../../../../../models/Location';
import { LocationCell } from '../../../../../models/LocationCell';
import { ProductHistory } from '../../../../../models/ProductHistory';
import { Tag } from '../../../../../models/Tag';
import { Shop } from '../../../../../models/Shop';

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post<{ Querystring: {
      name: string;
      description?: string;
      stack_count: string;
      slots_count: string;
      price: string;
      tags: string;
      minecraft_icon?: string;
    } }>('/create', { preHandler: fastify.requireShopAccess }, async (request, reply) => {
    request.assertShopPermission('create_products');
    const shop = request.shop;
    const user = request.user;

    if (!shop || !user) {
      return reply.status(400).send({ message: 'Магазин или пользователь не найден.' });
    }

    const { name, description, stack_count, slots_count, price, tags, minecraft_icon } = request.query;

    if (name.length < 3 || name.length > 24) {
      return reply.status(400).send({ message: 'Длинна названия должна быть в пределах 3-24 символов.' });
    }

    if (description && description.length > 240) {
      return reply.status(400).send({ message: 'Длинна описания должна быть не более 240 символов.' });
    }

    if (parseInt(stack_count) < 1 || parseInt(stack_count) > 64) {
      return reply.status(400).send({ message: 'Кол-во предметов в 1 слоте должно быть в пределах 1-64.' });
    }

    if (parseInt(slots_count) < 1 || parseInt(slots_count) > 27) {
      return reply.status(400).send({ message: 'Кол-во слотов еденицы товара должно быть в пределах 1-27.' });
    }

    if (parseFloat(price) < 0.01 || parseFloat(price) > 1728) {
      return reply.status(400).send({ message: 'Цена товара должна быть в пределах 0.01-1728.' });
    }

    let tagList: Tag[] = [];
    if (tags) {
      const tagIds = tags.split('_');
      if (tagIds.length > 3) {
        return reply.status(400).send({ message: 'Количество тегов должно быть не более 3х.' });
      }
      tagList = await Tag.findAll({ where: { id: tagIds } });
      if (tagList.length !== tagIds.length) {
        return reply.status(400).send({ message: 'Некоторые теги не найдены. (Ты че, хакер?)' });
      }
    }

    const sequelize: Sequelize = fastify.sequelize;
    const transaction = await sequelize.transaction();

    try {
      const lockedShop = await Shop.findOne({
        where: { id: shop.id },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!lockedShop) {
        await transaction.rollback();
        return reply.status(400).send({ message: 'Магазин не найден.' });
      }

      const productsCount = await Product.count({
        where: { shopId: shop.id },
        transaction,
      });

      if (productsCount >= lockedShop.products_limit) {
        await transaction.rollback();
        return reply.status(402).send({ message: 'Создан максимум товаров.' });
      }

      const cell = await LocationCell.findOne({
        where: {
          slots: { [Op.gt]: parseInt(slots_count) },
          id: {
            [Op.notIn]: Sequelize.literal(
                `(SELECT DISTINCT "cellId" FROM "products" WHERE "cellId" IS NOT NULL AND "deletedAt" IS NULL)`
            ),
          },
        },
        include: [
          {
            model: Location,
            as: 'location',
            where: {
              type: 'storage',
              enabled: true,
            },
          },
        ],
        attributes: ['id'],
        transaction,
      });

      let fileUrl = minecraft_icon
          ? `https://assets.zaralx.ru/api/v1/minecraft/vanilla/item/${minecraft_icon}/icon`
          : process.env.DEFAULT_SHOP_ICON;

      if (request.body && (request.body as any).icon && (!minecraft_icon || minecraft_icon.length === 0)) {
        const buffer = await (request.body as any).icon.toBuffer();
        const file = {
          filename: (request.body as any).icon.filename,
          mimetype: (request.body as any).icon.mimetype,
          size: buffer.length,
          buffer: buffer,
        };

        if (file.size > 2 * 1024 * 1024) {
          await transaction.rollback();
          return reply.status(400).send({ message: 'Иконка должна быть не более 2 МБ!' });
        }

        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];
        if (!allowedMimeTypes.includes(file.mimetype)) {
          await transaction.rollback();
          return reply.status(400).send({ message: 'Допускаются только изображения JPEG, PNG, SVG или WEBP.' });
        }

        fileUrl = await uploadToS3(file, process.env.S3_BUCKET_NAME!, 'fresh/market/product_icon', true);
      }

      const newProduct = await Product.create({
        shopId: shop.id,
        name,
        description,
        stack_count: parseInt(stack_count),
        slots_count: parseInt(slots_count),
        price: parseFloat(price).toFixed(2),
        icon: fileUrl,
        cellId: cell?.id,
      } as any, { transaction });

      if (tagList.length > 0) {
        await (newProduct as any).addTags(tagList.map(tag => tag.id), { transaction });
      }

      await ProductHistory.create({
        action_type: 'created',
        userId: user.id,
        productId: newProduct.id,
        data: {
          name: newProduct.name,
          description: newProduct.description,
          stack_count: newProduct.stack_count,
          slots_count: newProduct.slots_count,
          price: newProduct.price,
          icon: newProduct.icon,
          tags: tagList.map(tag => tag.name),
        },
      } as any, { transaction });

      await transaction.commit();

      await notifyWorkers(fastify, 3, 'Новая проверка', 'Проверьте товар', '/cabinet/freshmarket/work/secretary/verify/products');

      return reply.status(200).send({ message: 'Товар успешно создан.', product: newProduct });
    } catch (err) {
      await transaction.rollback();
      console.error(err);
      return reply.status(500).send({ message: 'Ошибка при создании товара.' });
    }
  });
};

export default route;
