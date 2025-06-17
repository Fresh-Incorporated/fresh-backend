'use strict'

const { uploadToS3 } = require("../../../../../../utils/s3Util");
const {Sequelize, Op} = require("sequelize");
const {notifyWorkers} = require("../../../../../../utils/notifyUtil");
module.exports = async function (fastify, opts) {
    fastify.post('/refill', { preHandler: fastify.requireProductAccess }, async function (request, reply) {
        const Location = fastify.sequelize.model('Location');
        const LocationCell = fastify.sequelize.model('LocationCell');
        const Product = fastify.sequelize.model('Product');
        const ProductHistory = fastify.sequelize.model('ProductHistory');

        if (!request.isOwner) return reply.status(400).send({
            message: "Магазин не существует или у вас недостаточно прав."
        });


        if (request.product.verify_status !== 1) {
            return reply.status(400).send({ message: "Товар не проверен" })
        }


        if (request.product.cellId == null || request.product.refill_status > 0) {
            return reply.status(400).send({ message: "Товар уже пополняется" })
        }

        // Подбор ячейки
        const cell = await LocationCell.findOne({
            where: {
                id: {
                    [Op.notIn]: Sequelize.literal(
                        `(SELECT DISTINCT "refillCellId" FROM "products" WHERE "refillCellId" IS NOT NULL)`
                    ),
                },
            },
            include: [
                {
                    model: Location,
                    as: "location",
                    where: {
                        type: "refill",
                        enabled: true
                    },
                    attributes: { exclude: ['deletedAt', 'updatedAt', 'createdAt'] },
                }
            ],
            attributes: { exclude: ['locationId'] },
        });

        if (!cell) {
            return reply.status(400).send({ message: "Все ячейки для пополнения заняты. Попробуйте позже" })
        }

        await request.product.update({
            refill_status: 1,
            refillCellId: cell.id,
        })

        await ProductHistory.create({
            action_type: "refill_started",
            data: {
                cell: {
                    id: cell.id,
                    letter: cell.letter,
                    number: cell.number,
                    location: {
                        id: cell.location.id,
                        name: cell.location.name,
                    },
                },
            },
            userId: request.user.id, // Тот кто создал запрос на пополнение
            productId: request.product.id,
        })

        return reply.status(200).send({ message: "Ячейка для пополнения выделена! ", cell })
    });

    fastify.post('/refill/end', { preHandler: fastify.requireProductAccess }, async function (request, reply) {
        const ProductHistory = fastify.sequelize.model('ProductHistory');

        if (!request.isOwner) return reply.status(400).send({
            message: "Магазин не существует или у вас недостаточно прав."
        });


        if (request.product.verify_status !== 1) {
            return reply.status(400).send({ message: "Товар не проверен" })
        }

        if (request.product.refill_status === 0) {
            return reply.status(400).send({ message: "Товар не пополняется" })
        }

        if (request.product.refill_status === 2) {
            return reply.status(400).send({ message: "Товар уже пополнен" })
        }

        await request.product.update({
            refill_status: 2
        })

        await ProductHistory.create({
            action_type: "refill_waiting",
            userId: request.user.id, // Тот кто завершил пополнение
            productId: request.product.id,
        })

        notifyWorkers(fastify, 2, "fm_logic_refill", "Новое пополнение", "Пополните товар как можно скорей!", "/cabinet/freshmarket/work/logic/refill")

        return reply.status(200).send({ message: "Вы завершили пополнение! Ожидайте пока работники пополнят склад." })
    });
};
