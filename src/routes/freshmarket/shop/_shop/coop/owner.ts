import { FastifyPluginAsync } from 'fastify';
import { Op } from 'sequelize';
import { ShopCoOwner } from '../../../../../models/ShopCoOwner';
import { User } from '../../../../../models/User';
import { notifyUser } from '../../../../../utils/notifyUtil';

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post('/invite', { preHandler: fastify.requireShopAccess }, async (request, reply) => {
    const user = request.user;
    const shop = request.shop;
    if (!user || !shop) return reply.status(400).send({ message: 'Магазин не существует или у вас недостаточно прав.' });
    if (!request.isOwner) return reply.status(400).send({ message: 'Магазин не существует или у вас недостаточно прав.' });
    const { uuid, permissions } = request.body as { uuid?: string; permissions?: Record<string, boolean> };
    if (!uuid) {
      return reply.status(400).send({ message: 'Укажите пользователя (uuid)' });
    }
    if (!permissions || typeof permissions !== 'object') {
      return reply.status(400).send({ message: 'Укажите права доступа' });
    }
    if (uuid === user.uuid) {
      return reply.status(400).send({ message: 'Вы не можете пригласить самого себя' });
    }
    const invitedUser = await User.findOne({ where: { uuid }, attributes: ['id', 'uuid'] });
    if (!invitedUser) {
      return reply.status(404).send({ message: 'Пользователь не найден' });
    }
    const existingCoOwner = await ShopCoOwner.findOne({
      where: {
        shopId: shop.id,
        userId: invitedUser.id,
        status: { [Op.in]: ['pending', 'accepted'] },
      },
    });
    if (existingCoOwner) {
      return reply.status(400).send({ message: 'Этот пользователь уже приглашён или является совладельцем' });
    }
    await ShopCoOwner.create({
      shopId: shop.id,
      userId: invitedUser.id,
      status: 'pending',
      edit_shop_info: !!permissions.edit_shop_info,
      create_products: !!permissions.create_products,
      edit_products: !!permissions.edit_products,
      refill_products: !!permissions.refill_products,
      delete_products: !!permissions.delete_products,
    } as any);
    await notifyUser(fastify, invitedUser.id, `fm_invited_shop_${shop.id}`, 'Приглашение в магазин', `Вас пригласили в магазин ${shop.name}`, '/cabinet/freshmarket/invites');
    return reply.send({ message: 'Приглашение отправлено' });
  });

  fastify.post('/delete', { preHandler: fastify.requireShopAccess }, async (request, reply) => {
    const user = request.user;
    const shop = request.shop;
    if (!user || !shop) return reply.status(400).send({ message: 'Магазин не существует или у вас недостаточно прав.' });
    const { id } = request.body as { id?: number };
    if (!id) {
      return reply.status(400).send({ message: 'Укажите пользователя' });
    }
    if (!request.isOwner && user.id !== id) {
      return reply.status(400).send({ message: 'Магазин не существует или у вас недостаточно прав.' });
    }
    const targetUser = await User.findOne({ where: { id }, attributes: ['id'] });
    if (!targetUser) {
      return reply.status(404).send({ message: 'Пользователь не найден' });
    }
    const existingCoOwner = await ShopCoOwner.findOne({ where: { shopId: shop.id, userId: targetUser.id } });
    if (!existingCoOwner) {
      return reply.status(400).send({ message: 'Этот пользователь не совладелец' });
    }
    await existingCoOwner.destroy();
    await notifyUser(fastify, targetUser.id, `fm_removed_from_shop_${targetUser.id}`, 'Удаление из магазина', `Вас больше не совладелец магазина ${shop.name}`, '/cabinet');
    return reply.send({ message: 'Пользователь больше не является совладельцем.' });
  });

  fastify.post('/edit', { preHandler: fastify.requireShopAccess }, async (request, reply) => {
    const user = request.user;
    const shop = request.shop;
    if (!user || !shop) return reply.status(400).send({ message: 'Магазин не существует или у вас недостаточно прав.' });
    if (!request.isOwner) {
      return reply.status(400).send({ message: 'Магазин не существует или у вас недостаточно прав.' });
    }
    const { id, permissions } = request.body as { id?: number; permissions?: Record<string, boolean> };
    if (!id) {
      return reply.status(400).send({ message: 'Укажите пользователя' });
    }
    const targetUser = await User.findOne({ where: { id }, attributes: ['id'] });
    if (!targetUser) {
      return reply.status(404).send({ message: 'Пользователь не найден' });
    }
    const coOwner = await ShopCoOwner.findOne({
      where: {
        shopId: shop.id,
        userId: targetUser.id,
        status: 'accepted',
      },
    });
    if (!coOwner) {
      return reply.status(400).send({ message: 'Этот пользователь не является совладельцем' });
    }
    await coOwner.update({
      edit_shop_info: !!permissions?.edit_shop_info,
      create_products: !!permissions?.create_products,
      edit_products: !!permissions?.edit_products,
      refill_products: !!permissions?.refill_products,
      delete_products: !!permissions?.delete_products,
    });
    await notifyUser(fastify, targetUser.id, `fm_permissions_updated_${targetUser.id}`, 'Изменение прав в магазине', `Ваши права в магазине ${shop.name} были изменены`, '/cabinet');
    return reply.send({ message: 'Права пользователя обновлены.' });
  });
};

export default route;
