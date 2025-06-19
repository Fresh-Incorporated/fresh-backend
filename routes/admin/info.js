'use strict'

const { Op, fn, col, literal } = require('sequelize');
const { format, subDays } = require('date-fns');

module.exports = async function (fastify, opts) {
    fastify.get('/stats', { preHandler: fastify.requireAuth }, async function (request, reply) {
        if (!request.user.admin) return reply.status(403).send({ message: "Недостаточно прав." });


        const User = fastify.sequelize.model('User');
        const Shop = fastify.sequelize.model('Shop');

        // Кол-во пользователей
        const totalUsers = await User.count();

        // Получаем всех пользователей и магазины одним запросом
        const [users, shops] = await Promise.all([
            User.findAll({ attributes: ['id', 'balance'] }),
            Shop.findAll({ attributes: ['id', 'balance', 'ownerId'] })
        ]);

        // Общие балансы
        const totalBalanceUsers = users.reduce((sum, u) => sum + u.balance, 0);
        const totalBalanceShops = shops.reduce((sum, s) => sum + s.balance, 0);

        // Расходы на магазины (по прогрессии)
        const shopCountsByUser = shops.reduce((acc, shop) => {
            acc[shop.ownerId] = (acc[shop.ownerId] || 0) + 1;
            return acc;
        }, {});

        let totalSpentOnShops = 0;
        for (const userId in shopCountsByUser) {
            const count = shopCountsByUser[userId];
            const cost = count * 16 + (count * (count - 1)) * 64 / 2;
            totalSpentOnShops += cost;
        }

        // Регистрации за последние 90 дней
        const today = new Date();
        const startDate = subDays(today, 89); // включая сегодня

        const registrationsRaw = await User.findAll({
            attributes: [
                [literal('DATE("createdAt")'), 'date'],
                [fn('COUNT', '*'), 'count']
            ],
            where: {
                createdAt: {
                    [Op.gte]: startDate
                }
            },
            group: [literal('DATE("createdAt")')],
            order: [[literal('DATE("createdAt")'), 'ASC']],
            raw: true
        });

        // Преобразование выборки в мапу для быстрого доступа
        const registrationsMap = {};
        for (const r of registrationsRaw) {
            registrationsMap[r.date] = Number(r.count);
        }

        // Сбор финального массива
        const registrations = [];
        for (let i = 0; i < 90; i++) {
            const date = format(subDays(today, 89 - i), 'yyyy-MM-dd');
            registrations.push({
                date,
                count: registrationsMap[date] || 0
            });
        }

        return reply.status(200).send({
            totalSpentOnShops,
            totalBalanceUsers,
            totalBalanceShops,
            totalUsers,
            registrations
        });
    });
};