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

    fastify.get('/shops/search', async function (request, reply) {
        const Shop = fastify.sequelize.model('Shop');
        const User = fastify.sequelize.model('User');
        const ShopCoOwner = fastify.sequelize.model('ShopCoOwner');
        const Product = fastify.sequelize.model('Product');

        const where = {};

        if (request.query.id !== undefined && request.query.id !== null) {
            where.id = request.query.id;
        }

        if (request.query.tag !== undefined && request.query.tag !== null) {
            where.tag = request.query.tag;
        }

        if (request.query.name !== undefined && request.query.name !== null) {
            where.name = { [Op.iLike]: `%${request.query.name}%` };
        }

        const shops = await Shop.findAll({
            include: [
                {
                    model: User,
                    as: "owner",
                    attributes: ["id", "uuid", "nickname"]
                },
                {
                    model: ShopCoOwner,
                    as: "co_owners",
                    include: {
                        model: User,
                        as: "user",
                        attributes: ["id", "uuid", "nickname"]
                    }
                },
                {
                    model: Product,
                    as: "products",
                    attributes: ["id", "icon", "name"]
                }
            ],
            limit: request.query.limit ? (request.query?.limit < 1 || request.query?.limit > 50 ? 5 : request.query?.limit) : 5,
            order: [['id', 'DESC']],
            where: where
        })
        return reply.status(200).send({
            shops
        });
    });
};
