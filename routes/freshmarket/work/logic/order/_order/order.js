'use strict'

const {Op, Sequelize} = require("sequelize");
const {notifyWorkers} = require("../../../../../../utils/notifyUtil");
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

            if (request.user.fm_worker < 2) {
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

    fastify.post('/collect', async function (request, reply) {
        const OrderHistory = fastify.sequelize.model('OrderHistory');
        const Location = fastify.sequelize.model('Location');
        const LocationCell = fastify.sequelize.model('LocationCell');

        if (request.order.status !== 0) {
            return reply.status(400).send({ message: "Задача недоступна (Возможно уже выполняется другим работником)"})
        }

        const cell = await LocationCell.findOne({
            where: {
                id: {
                    [Op.notIn]: Sequelize.literal(
                        `(SELECT DISTINCT "deliverCellId" FROM "orders" WHERE "deliverCellId" IS NOT NULL)`
                    ),
                },
            },
            include: [
                {
                    model: Location,
                    as: "location",
                    where: {
                        type: "deliver",
                        enabled: true
                    }
                }
            ],
        });

        if (!cell) {
            return reply.status(500).send({ message: "Не получилось найти свободную ячейку для курьера, попробуйте позже.." })
        }

        await request.order.update({
            status: 1,
            currentWorkerId: request.user.id,
            deliverCellId: cell.id
        })

        await OrderHistory.create({
            action_type: "collect_picked",
            userId: request.user.id, // Тот кто взялся за сбор заказа
            orderId: request.order.id,
        })

        return reply.status(200).send({message: "Задача на сбор заказа принята!"});
    });

    fastify.post('/collect/end', async function (request, reply) {
        const OrderHistory = fastify.sequelize.model('OrderHistory');

        if (request.order.status !== 1 || request.order.currentWorkerId !== request.user.id) {
            return reply.status(400).send({ message: "Задача недоступна (Возможно уже завершена)"})
        }

        if (request.order.deliverCellId == null) {
            return reply.status(400).send({ message: "Не присвоена ячейка курьера! (Обратитесь к директору)"})
        }

        await request.order.update({
            status: 2,
            currentWorkerId: null,
        })

        await OrderHistory.create({
            action_type: "collect_finished",
            userId: request.user.id, // Тот кто взялся за сбор заказа
            orderId: request.order.id,
        })

        notifyWorkers(fastify, 1, "fm_delivery", "Новая доставка", "Доставьте его как можно скорей!", "/freshmarket/work/delivery")

        return reply.status(200).send({message: "Задача на сбор заказа завершена!"});
    });
};
