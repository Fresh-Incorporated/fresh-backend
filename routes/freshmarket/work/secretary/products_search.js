'use strict'

const {notifyUser} = require("../../../../utils/notifyUtil");
const {Op} = require("sequelize");
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

    fastify.get('/products/search', async function (request, reply) {
        const Shop = fastify.sequelize.model('Shop');
        const Product = fastify.sequelize.model('Product');
        const LocationCell = fastify.sequelize.model('LocationCell');

        const where = {};

        if (request.query.id !== undefined && request.query.id !== null) {
            where.id = request.query.id;
        }

        if (request.query.name !== undefined && request.query.name !== null) {
            where.name = { [Op.iLike]: `%${request.query.name}%` };
        }

        const products = await Product.findAll({
            include: [
                {
                    model: Shop,
                    as: "shop",
                    attributes: ["id", "name", "icon"]
                },
                {
                    model: LocationCell,
                    as: "cell",
                    attributes: ["id", "letter", "number"]
                }
            ],
            limit: request.query.limit ? (request.query?.limit < 1 || request.query?.limit > 50 ? 5 : request.query?.limit) : 5,
            order: [['id', 'DESC']],
            where: where
        })
        return reply.status(200).send({
            products
        });
    });
};
