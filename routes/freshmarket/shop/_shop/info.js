'use strict'

const { uploadToS3 } = require("../../../../utils/s3Util");
const { Op, fn, col, literal } = require('sequelize');
const fns = require('date-fns'); // { format, subDays, isSameDay, parseISO }

module.exports = async function (fastify, opts) {


    fastify.addHook('onRequest', async (request, reply) => {
        try {
            const accessToken = request.cookies.access_token;
            if (!accessToken) {
                return reply.status(401).send({ error: 'Missing access token' });
            }

            request.user = fastify.jwt.verify(accessToken);
        } catch (err) {
            reply.status(401).send({ error: 'Unauthorized' });
        }
    });

    fastify.get('/sells', async function (request, reply) {
        const { User, Shop, Product, Order } = fastify.sequelize.models;

        const user = await User.findByPk(request.user.id, {
            attributes: { exclude: ['updatedAt'] }
        });

        if (!user) {
            return reply.status(400).send({ message: "Пользователь не найден." });
        }

        const shop = await Shop.findOne({
            where: { id: request.params.shop, ownerId: user.id },
            attributes: ['id']
        });

        if (!shop) {
            return reply.status(400).send({
                message: "Магазин не существует или у вас недостаточно прав."
            });
        }

        const products = await Product.findAll({
            where: { shopId: shop.id },
            attributes: ['id']
        });

        const productIds = products.map(p => p.id);

        if (productIds.length === 0) {
            return reply.send(generateEmptyDays());
        }

        const today = new Date();
        const startDate = fns.startOfDay(fns.subDays(today, 6)); // 6 дней назад + сегодня = 7

        const orders = await Order.findAll({
            where: {
                createdAt: { [Op.gte]: startDate },
                [Op.or]: productIds.map(id =>
                    literal(`data->'products' @> '[{"id": ${id}}]'`)
                )
            },
            attributes: ['createdAt', 'data'],
            order: [['createdAt', 'ASC']]
        });

        const dailySales = generateEmptyDays();

        for (const order of orders) {
            const day = dailySales.find(d => fns.isSameDay(new Date(order.createdAt), new Date(d.date)));
            if (!day) continue;

            for (const product of order.data.products) {
                if (productIds.includes(product.id) && product.price != null && product.count != null) {
                    day.total += product.price * product.count;
                }
            }
        }

        return reply.send(dailySales);
    });

    function generateEmptyDays() {
        const today = new Date();
        return Array.from({ length: 7 }, (_, i) => {
            const date = fns.format(fns.subDays(today, 6 - i), 'yyyy-MM-dd');
            return { date, total: 0 };
        });
    }
};
