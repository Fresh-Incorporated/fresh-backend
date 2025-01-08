'use strict'

const {Op} = require("sequelize");
module.exports = async function (fastify, opts) {
    fastify.addHook('onRequest', async (request, reply) => {
        const User = fastify.sequelize.model('User');
        try {
            const accessToken = request.cookies.access_token
            if (!accessToken) {
                return reply.status(401).send({error: 'Missing access token'})
            }

            request.user = fastify.jwt.verify(accessToken)

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
        } catch (err) {
            reply.status(401).send({error: 'Unauthorized'})
        }
    })

    fastify.post('/:order/confirm', async function (request, reply) {
        const Order = fastify.sequelize.model('Order');
        const OrderHistory = fastify.sequelize.model('OrderHistory');

        const order = await Order.findOne({
            where: {
                id: request.params.order,
                customerId: request.user.id
            }
        })

        if (!order) {
            return reply.status(400).send({ message: "Заказ не найден." })
        }

        if (order.status < 4) {
            return reply.status(400).send({ message: "Заказ ещё не доставили." })
        }

        if (order.status >= 5) {
            return reply.status(400).send({ message: "Вы уже подтвердили этот заказ." })
        }

        await order.update({
            status: 5
        })

        await OrderHistory.create({
            action_type: "confirmed",
            userId: request.user.id, // Тот кто подтверид заказ
            orderId: order.id,
        })

        return reply.status(200).send({ message: "Получение подтверждено." })
    })
}
