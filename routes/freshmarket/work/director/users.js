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

    fastify.get('/users/workers', async function (request, reply) {
        const User = fastify.sequelize.model('User');

        const users = await User.findAll({
            where: {
                fm_worker: {
                    [Op.gt]: 0
                }
            }
        });

        return reply.status(200).send({
            users
        });
    });

    fastify.post('/users/list', async function (request, reply) {
        const User = fastify.sequelize.model('User');

        const users = await User.findAll({
            where: {
                id: {
                    [Op.in]: request.body.ids
                }
            }
        });

        return reply.status(200).send({
            users
        });
    });
};
