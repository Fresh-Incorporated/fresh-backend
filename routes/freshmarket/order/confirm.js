'use strict'

const {Op} = require("sequelize");
module.exports = async function (fastify, opts) {
    fastify.post('/:order/confirm', { preHandler: fastify.requireAuth },  async function (request, reply) {
        const Order = fastify.sequelize.model('Order');
        const OrderHistory = fastify.sequelize.model('OrderHistory');

        const order = await Order.findOne({
            where: {
                id: request.params.order,
                customerId: request.user.id
            },
            attributes: ['id', 'status']
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
            status: 5,
            branchCellId: null,
        })

        await OrderHistory.create({
            action_type: "confirmed",
            userId: request.user.id, // Тот кто подтвердил заказ
            orderId: order.id,
        })

        return reply.status(200).send({ message: "Получение подтверждено." })
    })
}
