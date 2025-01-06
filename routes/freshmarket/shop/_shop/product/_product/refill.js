'use strict'

const { uploadToS3 } = require("../../../../../../utils/s3Util");
const {Sequelize, Op} = require("sequelize");
module.exports = async function (fastify, opts) {
    fastify.addHook('onRequest', async (request, reply) => {
        const User = fastify.sequelize.model('User');
        const Shop = fastify.sequelize.model('Shop');
        const Product = fastify.sequelize.model('Product');
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
                attributes: { exclude: ['updatedAt'] },
            });

            if (!user) {
                return reply.status(400).send({
                    message: "Пользователь не найден."
                });
            }

            request.user = user

            const shop = await Shop.findOne({where: { id: request.params.shop, ownerId: request.user.id }});

            if (!shop) {
                return reply.status(400).send({
                    message: "Магазин не существует или у вас недостаточно прав."
                });
            }

            request.shop = shop

            const product = await Product.findOne({ where: { shopId: shop.id, id: request.params.product } });

            if (!product) {
                return reply.status(400).send({
                    message: "Товар не существует или у вас недостаточно прав."
                });
            }

            if (product.verify_status !== 1) {
                return reply.status(400).send({ message: "Товар не проверен" })
            }

            request.product = product
        } catch (err) {
            reply.status(401).send({ error: 'Unauthorized' });
        }
    });

    fastify.post('/refill', async function (request, reply) {
        const Location = fastify.sequelize.model('Location');
        const LocationCell = fastify.sequelize.model('LocationCell');
        const ProductHistory = fastify.sequelize.model('ProductHistory');

        if (request.product.cell || request.product.refill_status > 0) {
            return reply.status(400).send({ message: "Товар уже пополняется" })
        }

        // Подбор ячейки
        const cell = await LocationCell.findOne({
            where: {
                id: {
                    [Op.notIn]: Sequelize.literal(
                        `(SELECT DISTINCT "cellId" FROM "products" WHERE "cellId" IS NOT NULL)`
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
                    }
                }
            ],
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
            userId: request.user.id, // Тот кто создал запрос на пополнение
            productId: request.product.id,
        })

        return reply.status(200).send({ message: "Ячейка для пополнения выделена! ", cell })
    });

    fastify.post('/refill/end', async function (request, reply) {
        const ProductHistory = fastify.sequelize.model('ProductHistory');

        if (request.product.refill_status === 0) {
            return reply.status(400).send({ message: "Товар не пополняется" })
        }

        if (request.product.refill_status === 2) {
            return reply.status(400).send({ message: "Товар уже пополнен" })
        }

        await request.product.update({
            refill_status: 2,
            refillCellId: null
        })

        await ProductHistory.create({
            action_type: "refill_waiting",
            userId: request.user.id, // Тот кто завершил пополнение
            productId: request.product.id,
        })

        return reply.status(200).send({ message: "Вы завершили пополнение! Ожидайте пока работники пополнят склад." })
    });
};
