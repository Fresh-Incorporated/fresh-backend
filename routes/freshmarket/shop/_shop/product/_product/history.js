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

            request.product = product
        } catch (err) {
            console.error(err)
            reply.status(500).send({ message: 'Произошла ошибка' });
        }
    });

    fastify.get('/history', async function (request, reply) {
        const User = fastify.sequelize.model('User');
        const ProductHistory = fastify.sequelize.model('ProductHistory');

        const history = await ProductHistory.findAll({
            where: {
                productId: request.product.id
            },
            attributes: ["id", "action_type", "userId", "productId"],
            include: [
                {
                    model: User,
                    as: "user",
                    attributes: ["id", "nickname", "uuid", "discordId"],
                }
            ]
        });

        return reply.status(200).send(history);
    });
};
