'use strict'

const { uploadToS3 } = require("../../../../utils/s3Util");
const {Op} = require("sequelize");
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
        const User = fastify.sequelize.model('User');
        const Shop = fastify.sequelize.model('Shop');
        const Product = fastify.sequelize.model('Product')

        const user = await User.findOne({
            where: {
                id: request.user.id
            },
            attributes: { exclude: ['updatedAt'] },
        });

        if (!user) {
            return reply.status(400).send({
                message: "Пользователь не найден."
            });
        }

        const shop = await Shop.findOne({ where: { id: request.params.shop, ownerId: request.user.id }, attributes: ['id'] });

        const products = await Product.findAll({ where: { shopId: shop.id }, attributes: ['id'] });
        const productIds = products.map(item => item.id);

        if (!shop) {
            return reply.status(400).send({
                message: "Магазин не существует или у вас недостаточно прав."
            });
        }

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const orders = await fastify.sequelize.models.Order.findAll({
            where: {
                [Op.and]: [
                    {
                        [Op.or]: productIds.map((productId) =>
                            fastify.sequelize.literal(
                                `data->'products' @> '[{"id": ${productId}}]'`
                            )
                        )
                    },
                    {
                        createdAt: {
                            [Op.gte]: sevenDaysAgo
                        }
                    }
                ]
            },
            order: [['createdAt', 'ASC']],
            attributes: ['id', 'createdAt', 'data']
        });

        const today = new Date();


        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const date = fns.subDays(today, i);
            return {
                date: fns.format(date, 'yyyy-MM-dd'),
                total: 0
            };
        }).reverse();

        for (const order of orders) {
            const matchedDay = last7Days.find(day => fns.isSameDay(order.createdAt, new Date(day.date)));

            for (const product of order.data.products) {
                if (productIds.indexOf(product.id)) {
                    matchedDay.total += product.price * product.count;
                }

            }
        }

        return reply.status(200).send(last7Days);
    });
};
