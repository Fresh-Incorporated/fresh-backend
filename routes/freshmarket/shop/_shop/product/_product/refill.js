'use strict'

const { uploadToS3 } = require("../../../../../../utils/s3Util");
const {Sequelize, Op} = require("sequelize");
const {notifyWorkers} = require("../../../../../../utils/notifyUtil");
module.exports = async function (fastify, opts) {
    fastify.addHook('onRequest', async (request, reply) => {
        const User = fastify.sequelize.model('User');
        const Shop = fastify.sequelize.model('Shop');
        try {
            const accessToken = request.cookies.access_token;
            if (!accessToken) {
                return reply.status(401).send({ error: 'Missing access token' });
            }

            request.user = fastify.jwt.verify(accessToken);

            const user = await User.findOne({
                where: {
                    id: request.user.id
                },
                attributes: ['id'],
            });

            if (!user) {
                return reply.status(400).send({
                    message: "Пользователь не найден."
                });
            }

            const shop = await Shop.findOne({ where: { id: request.params.shop, ownerId: request.user.id }, attributes: ['id'] });

            if (!shop) {
                return reply.status(400).send({
                    message: "Магазин не существует или у вас недостаточно прав."
                });
            }
            request.shop = shop
        } catch (err) {
            reply.status(401).send({ error: 'Unauthorized' });
        }
    });

    fastify.post('/refill', async function (request, reply) {
        const Location = fastify.sequelize.model('Location');
        const LocationCell = fastify.sequelize.model('LocationCell');
        const Product = fastify.sequelize.model('Product');
        const ProductHistory = fastify.sequelize.model('ProductHistory');

        const product = await Product.findOne({ where: { shopId: request.shop.id, id: request.params.product }, attributes: ['id', 'cellId', 'verify_status', 'refill_status'] });

        if (!product) {
            return reply.status(400).send({
                message: "Товар не существует или у вас недостаточно прав."
            });
        }

        if (product.verify_status !== 1) {
            return reply.status(400).send({ message: "Товар не проверен" })
        }


        if (product.cellId == null || product.refill_status > 0) {
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

        await product.update({
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
            productId: product.id,
        })

        return reply.status(200).send({ message: "Ячейка для пополнения выделена! ", cell })
    });

    fastify.post('/refill/end', async function (request, reply) {
        const ProductHistory = fastify.sequelize.model('ProductHistory');
        const Product = fastify.sequelize.model('Product');

        const product = await Product.findOne({ where: { shopId: request.shop.id, id: request.params.product }, attributes: ['id', 'verify_status', 'refill_status'] });

        if (!product) {
            return reply.status(400).send({
                message: "Товар не существует или у вас недостаточно прав."
            });
        }

        if (product.verify_status !== 1) {
            return reply.status(400).send({ message: "Товар не проверен" })
        }

        if (product.refill_status === 0) {
            return reply.status(400).send({ message: "Товар не пополняется" })
        }

        if (product.refill_status === 2) {
            return reply.status(400).send({ message: "Товар уже пополнен" })
        }

        await product.update({
            refill_status: 2
        })

        await ProductHistory.create({
            action_type: "refill_waiting",
            userId: request.user.id, // Тот кто завершил пополнение
            productId: product.id,
        })

        notifyWorkers(fastify, 2, "fm_logic_refill", "Новое пополнение", "Пополните товар как можно скорей!", "/freshmarket/work/logic/refill")

        return reply.status(200).send({ message: "Вы завершили пополнение! Ожидайте пока работники пополнят склад." })
    });
};
