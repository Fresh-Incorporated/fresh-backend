'use strict'

module.exports = async function (fastify, opts) {
    fastify.addHook('onRequest', async (request, reply) => {
        const User = fastify.sequelize.model('User');
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

            if (request.user.fm_worker < 3) {
                return reply.status(403).send({
                    message: "Недостаточно прав."
                });
            }
        } catch (err) {
            reply.status(401).send({ error: 'Unauthorized' });
        }
    });

    fastify.post('/product/:id/accept', async function (request, reply) {
        const Shop = fastify.sequelize.model('Shop');
        const Product = fastify.sequelize.model('Product');
        const ProductHistory = fastify.sequelize.model('ProductHistory');
        const LocationCell = fastify.sequelize.model('LocationCell');

        const product = await Product.findOne({
            where: {
                id: request.params.id,
                verify_status: 0
            },
            include: [
                {
                    model: Shop,
                    as: "shop",
                    where: {
                        verify_status: 1
                    }
                },
                {
                    model: LocationCell,
                    as: "cell",
                }
            ]
        });

        if (!product) {
            return reply.status(400).send({
                message: "Товар не найден (Возможно уже проверен)."
            });
        }

        if (!product.cell) {
            return reply.status(400).send({
                message: "Не присвоена ячейка."
            });
        }

        await product.update({verify_status: 1});

        await ProductHistory.create({
            action_type: "accepted",
            userId: request.user.id, // Тот кто подтвердил товар
            productId: product.id,
        })

        return reply.status(200).send({
            message: "Товар подтверждён"
        });
    });

    fastify.post('/product/:id/decline', async function (request, reply) {
        const Shop = fastify.sequelize.model('Shop');
        const Product = fastify.sequelize.model('Product');
        const ProductHistory = fastify.sequelize.model('ProductHistory');

        const product = await Product.findOne({
            where: {
                id: request.params.id,
                verify_status: 0
            },
            include: [
                {
                    model: Shop,
                    as: "shop",
                    where: {
                        verify_status: 1
                    }
                }
            ]
        });

        if (!product) {
            return reply.status(400).send({
                message: "Товар не найден (Возможно уже проверен)."
            });
        }

        await product.update({verify_status: -1});

        await ProductHistory.create({
            action_type: "declined",
            userId: request.user.id, // Тот кто отклонил товар
            productId: product.id,
            message: request.body.message
        })

        return reply.status(200).send({
            message: "Товар отклонён"
        });
    });

    fastify.get('/products', async function (request, reply) {
        const User = fastify.sequelize.model('User');
        const Shop = fastify.sequelize.model('Shop');
        const Product = fastify.sequelize.model('Product');
        const Location = fastify.sequelize.model('Location');
        const LocationCell = fastify.sequelize.model('LocationCell');
        const ProductHistory = fastify.sequelize.model('ProductHistory');
        const Tag = fastify.sequelize.model('Tag');

        const products = await Product.findAll({
            where: {
                verify_status: 0
            },
            include: [
                {
                    model: Shop,
                    as: "shop",
                    where: {
                        verify_status: 1
                    }
                },
                {
                    model: LocationCell,
                    as: "cell",
                    include: [
                        {
                            model: Location,
                            as: 'location'
                        }
                    ]
                },
                {
                    model: ProductHistory,
                    as: "history",
                    include: [
                        {
                            model: User,
                            as: 'user'
                        }
                    ]
                },
                {
                    model: Tag,
                    as: 'tags',
                    through: { attributes: [] }
                }
            ]
        });

        return reply.status(200).send(products);
    });
};
