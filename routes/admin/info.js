'use strict'

const { Op, fn, col, literal } = require('sequelize');
const { format, subDays } = require('date-fns');

module.exports = async function (fastify, opts) {
    fastify.get('/stats', { preHandler: fastify.requireAuth }, async function (request, reply) {
        if (!request.user.admin) return reply.status(403).send({ message: "Недостаточно прав." });

        const User = fastify.sequelize.model('User');
        const Shop = fastify.sequelize.model('Shop');
        const Order = fastify.sequelize.model('Order');
        const Location = fastify.sequelize.model('Location');
        const BalanceHistory = fastify.sequelize.model('BalanceHistory');

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

        let totalSpentOnShopAdditionalSlots = -(await BalanceHistory.sum("value", {
            where: {
                action_type: "freshmarket_pay"
            }
        })) - totalSpentOnShops;

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

        const registrationsMap = {};
        for (const r of registrationsRaw) {
            registrationsMap[r.date] = Number(r.count);
        }

        const registrations = [];
        for (let i = 0; i < 90; i++) {
            const date = format(subDays(today, 89 - i), 'yyyy-MM-dd');
            registrations.push({
                date,
                count: registrationsMap[date] || 0
            });
        }

        // Заказы за последние 90 дней (всего и по филиалам)
        const ordersRaw = await Order.findAll({
            attributes: [
                [literal('DATE("createdAt")'), 'date'],
                [fn('COUNT', '*'), 'count'],
                'branchId'
            ],
            where: {
                createdAt: {
                    [Op.gte]: startDate
                }
            },
            group: [literal('DATE("createdAt")'), 'branchId'],
            order: [[literal('DATE("createdAt")'), 'ASC']],
            raw: true
        });

        // Получаем список филиалов
        const branches = await Location.findAll({
            where: { type: 'branch' },
            attributes: ['id', 'name'],
            raw: true
        });

        const branchMap = {};
        for (const branch of branches) {
            branchMap[branch.id] = branch.name;
        }

        const ordersTotalMap = {};
        const ordersByBranchMap = {};

        for (const o of ordersRaw) {
            const date = o.date;
            const count = Number(o.count);
            const branchId = o.branchId;

            // Общие заказы по дням
            ordersTotalMap[date] = (ordersTotalMap[date] || 0) + count;

            // Заказы по филиалу
            if (branchId) {
                if (!ordersByBranchMap[branchId]) ordersByBranchMap[branchId] = {};
                ordersByBranchMap[branchId][date] = (ordersByBranchMap[branchId][date] || 0) + count;
            }
        }

        const orders = [];
        for (let i = 0; i < 90; i++) {
            const date = format(subDays(today, 89 - i), 'yyyy-MM-dd');

            const entry = {
                date,
                total: ordersTotalMap[date] || 0,
                branches: {}
            };

            for (const branchId in branchMap) {
                entry.branches[branchMap[branchId]] = ordersByBranchMap[branchId]?.[date] || 0;
            }

            orders.push(entry);
        }

        return reply.status(200).send({
            totalSpentOnShops,
            totalSpentOnShopAdditionalSlots,
            totalBalanceUsers,
            totalBalanceShops,
            totalUsers,
            registrations,
            orders
        });
    });
};