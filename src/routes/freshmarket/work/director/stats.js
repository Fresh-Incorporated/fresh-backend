'use strict'

const {uploadToS3} = require("../../../../utils/s3Util");
const {Op, literal} = require("sequelize");
module.exports = async function (fastify, opts) {
    fastify.addHook('onRequest', async (request, reply) => {
        const User = fastify.sequelize.model('User');
        try {
            const accessToken = request.cookies.access_token;
            if (!accessToken) {
                return reply.status(401).send({error: 'Missing access token'});
            }

            request.user = fastify.jwt.verify(accessToken);

            request.user = await User.findOne({
                where: {
                    id: request.user.id
                },
                attributes: {exclude: ['updatedAt']},
            });

            if (!request.user) {
                return reply.status(400).send({
                    message: "Пользователь не найден."
                });
            }

            if (request.user.fm_worker < 4) {
                return reply.status(403).send({
                    message: "Недостаточно прав."
                });
            }
        } catch (err) {
            reply.status(401).send({error: 'Unauthorized'});
        }
    });

    fastify.get('/stats', async function (request, reply) {
        const Order = fastify.sequelize.model('Order');
        const OrderHistory = fastify.sequelize.model('OrderHistory');
        const Shop = fastify.sequelize.model('Shop');
        const Product = fastify.sequelize.model('Product');
        const User = fastify.sequelize.model('User');
        const Location = fastify.sequelize.model('Location');
        const LocationCell = fastify.sequelize.model('LocationCell');

        const storages = await Location.findAll({
            where: {
                type: "storage"
            },
            attributes: ['id']
        })

        const totalOrders = await Order.count()
        const totalCells = await LocationCell.count({
            where: {
                locationId: {
                    [Op.in]: storages.map(s => s.id)
                }
            }
        });
        const usedCells = await Product.count({
            where: {
                cellId: {
                    [Op.not]: null
                }
            }
        });
        const shopCells = await Shop.sum("products_limit");

        return reply.status(200).send({totalOrders, totalCells, usedCells, shopCells});
    });
};
