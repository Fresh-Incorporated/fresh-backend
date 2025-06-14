'use strict'

const {notifyUser} = require("../../../../../../utils/notifyUtil");
module.exports = async function (fastify, opts) {
    fastify.addHook('onRequest', async (request, reply) => {
        const User = fastify.sequelize.model('User');
        const Product = fastify.sequelize.model('Product');
        const Location = fastify.sequelize.model('Location');
        const LocationCell = fastify.sequelize.model('LocationCell');
        const Shop = fastify.sequelize.model('Shop');

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

            const product = await Product.findOne({
                where: { id: request.params.product },
                include: [
                    {
                        model: LocationCell,
                        as: "cell",
                        include: [
                            {
                                model: Location,
                                as: "location"
                            }
                        ]
                    },
                    {
                        model: Shop,
                        as: "shop",
                        include: {
                            model: User,
                            as: "owner"
                        }
                    }
                ]
            });

            if (!product) {
                return reply.status(400).send({
                    message: "Товар не найден."
                });
            }

            request.product = product
        } catch (err) {
            reply.status(401).send({ error: 'Unauthorized' });
        }
    });

    fastify.post('/refill', async function (request, reply) {
        const ProductHistory = fastify.sequelize.model('ProductHistory');

        if (request.product.refill_status !== 2) {
            return reply.status(400).send({ message: "Товар недоступен (Возможно уже пополняется другим работником)"})
        }

        await request.product.update({
            refill_status: 3,
            currentRefillerId: request.user.id,
        })

        await ProductHistory.create({
            action_type: "refill_picked",
            userId: request.user.id, // Тот кто взялся за пополнение товара
            productId: request.product.id,
        })

        return reply.status(200).send({product: request.product, message: "Задача на пополнение товара принята!"});
    });

    fastify.post('/refill/end', async function (request, reply) {
        const ProductHistory = fastify.sequelize.model('ProductHistory');

        const {add, message} = request.body

        if (request.product.refill_status !== 3) {
            return reply.status(400).send({ message: "Товар недоступен (Возможно уже пополняется другим работником)"})
        }

        await request.product.increment({count: add || 0});

        await request.product.update({
            refill_status: 0,
            refillCellId: null,
            currentRefillerId: null,
        })

        await ProductHistory.create({
            action_type: "refill_completed",
            data: {
                count: add
            },
            message: message,
            userId: request.user.id, // Тот кто завершил пополнение товара
            productId: request.product.id,
        })

        notifyUser(fastify, request.product.shop.ownerId, "fm_refill_" + request.product.id, "Пополнение товара", "Товар " + request.product.name + " пополнен на " + add, "/cabinet/freshmarket_business")

        return reply.status(200).send({message: `Товар пополнен на ${add || 0}`});
    });
};
