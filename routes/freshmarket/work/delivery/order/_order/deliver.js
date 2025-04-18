'use strict'

const {Op, Sequelize} = require("sequelize");
module.exports = async function (fastify, opts) {
    fastify.addHook('onRequest', async (request, reply) => {
        const User = fastify.sequelize.model('User');
        const Order = fastify.sequelize.model('Order');

        try {
            const accessToken = request.cookies.access_token;
            if (!accessToken) {
                return reply.status(401).send({ error: 'Missing access token' });
            }

            request.user = fastify.jwt.verify(accessToken);

            request.user = await User.findOne({
                where: {
                    id: request.user.id
                },
                attributes: { exclude: ['updatedAt'] },
            });

            if (!request.user) {
                return reply.status(400).send({
                    message: "Пользователь не найден."
                });
            }

            if (request.user.fm_worker < 1) {
                return reply.status(403).send({
                    message: "Недостаточно прав."
                });
            }

            const order = await Order.findOne({
                where: { id: request.params.order },
            });

            if (!order) {
                return reply.status(400).send({
                    message: "Заказ не найден."
                });
            }

            request.order = order
        } catch (err) {
            reply.status(401).send({ error: 'Unauthorized' });
        }
    });

    fastify.post('/deliver', async function (request, reply) {
        const OrderHistory = fastify.sequelize.model('OrderHistory');
        const Location = fastify.sequelize.model('Location');
        const LocationCell = fastify.sequelize.model('LocationCell');

        if (request.order.status !== 2) {
            return reply.status(400).send({ message: "Задача недоступна (Возможно уже выполняется другим работником)"})
        }

        const cell = await LocationCell.findOne({
            where: {
                id: {
                    [Op.notIn]: Sequelize.literal(
                        `(SELECT DISTINCT "branchCellId" FROM "orders" WHERE "branchCellId" IS NOT NULL)`
                    ),
                },
            },
            include: [
                {
                    model: Location,
                    as: "location",
                    where: {
                        id: request.order.branchId,
                        type: "branch",
                        enabled: true
                    }
                }
            ],
        });

        if (!cell) {
            return reply.status(500).send({ message: "Не получилось найти свободную ячейку в филиале, попробуйте позже.." })
        }

        await request.order.update({
            status: 3,
            currentWorkerId: request.user.id,
            branchCellId: cell.id
        })

        await OrderHistory.create({
            action_type: "deliver_started",
            userId: request.user.id, // Тот кто взялся за доставку заказа
            orderId: request.order.id,
        })

        return reply.status(200).send({  message: "Задача на доставку заказа принята!"});
    });

    fastify.post('/deliver/end', async function (request, reply) {
        const OrderHistory = fastify.sequelize.model('OrderHistory');

        if (request.order.status !== 3 || request.order.currentWorkerId !== request.user.id) {
            return reply.status(400).send({ message: "Задача недоступна (Возможно уже завершена)"})
        }

        await request.order.update({
            status: 4,
            deliverCellId: null,
            currentWorkerId: null,
        })

        await OrderHistory.create({
            action_type: "deliver_finished",
            userId: request.user.id, // Тот кто взялся за доставку заказа
            orderId: request.order.id,
        })

        return reply.status(200).send({ message: "Задача на доставку заказа завершена!"});
    });
};
