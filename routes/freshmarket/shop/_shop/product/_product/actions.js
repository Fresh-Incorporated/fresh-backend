'use strict'

const { uploadToS3 } = require("../../../../../../utils/s3Util");
const {Sequelize, Op} = require("sequelize");
module.exports = async function (fastify, opts) {
    fastify.post('/delete', { preHandler: fastify.requireProductAccess }, async function (request, reply) {
        request.assertShopPermission('delete_products')

        const Order = fastify.sequelize.model('Order');

        if (request.product.count > 0) {
            return reply.status(400).send({message: "Нельзя удалить товар который есть на складе!"});
        }

        if (request.product.refill_status > 0) {
            return reply.status(400).send({message: "Нельзя удалить товар который пополняется!"});
        }

        const order = await Order.findOne({
            where: {
                status: { [Op.lt]: 2 },
                [Op.and]: Sequelize.literal(`"data"->'products' @> '[{"id": ${request.product.id}}]'`)
            }
        });
        const exists = !!order;

        if (exists) {
            return reply.status(400).send({message: "Нельзя удалить товар который выполняется в заказе! (Попробуйте позже)"});
        }

        await request.product.destroy();

        return reply.status(200).send({message: "Товар удалён"});
    });
};
