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

        const product = await Product.findOne({
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
                }
            ]
        });

        if (!product) {
            return reply.status(400).send({
                message: "Товар не найден (Возможно уже проверен)."
            });
        }

        await product.update({verify_status: 1});

        return reply.status(200).send({
            message: "Товар подтверждён"
        });
    });

    fastify.post('/product/:id/decline', async function (request, reply) {
        const Shop = fastify.sequelize.model('Shop');
        const Product = fastify.sequelize.model('Product');

        const product = await Product.findOne({
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
                }
            ]
        });

        if (!product) {
            return reply.status(400).send({
                message: "Товар не найден (Возможно уже проверен)."
            });
        }

        await product.update({verify_status: -1});

        return reply.status(200).send({
            message: "Товар отклонён"
        });
    });

    fastify.get('/products', async function (request, reply) {
        const Shop = fastify.sequelize.model('Shop');
        const Product = fastify.sequelize.model('Product');
        const Location = fastify.sequelize.model('Location');
        const LocationCell = fastify.sequelize.model('LocationCell');

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
                }
            ]
        });

        return reply.status(200).send(products);
    });
};
