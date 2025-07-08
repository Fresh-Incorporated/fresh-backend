'use strict'

const {Op} = require("sequelize");
module.exports = async function (fastify, opts) {
    fastify.addHook('onRequest', async (request, reply) => {
        const User = fastify.sequelize.model('User');
        const Product = fastify.sequelize.model('Product');
        const Location = fastify.sequelize.model('Location');
        const LocationCell = fastify.sequelize.model('LocationCell');

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
        } catch (err) {
            reply.status(401).send({ error: 'Unauthorized' });
        }
    });

    fastify.get('/list/refill', async function (request, reply) {
        const User = fastify.sequelize.model('User');
        const Shop = fastify.sequelize.model('Shop');
        const Product = fastify.sequelize.model('Product');
        const Location = fastify.sequelize.model('Location');
        const LocationCell = fastify.sequelize.model('LocationCell');
        const ProductHistory = fastify.sequelize.model('ProductHistory');

        const products = await Product.findAll({
            where: {
                refill_status: {
                    [Op.gte]: 2
                }
            },
            include: [
                {
                    model: User,
                    as: "currentRefiller"
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
                    model: LocationCell,
                    as: "refillCell",
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
