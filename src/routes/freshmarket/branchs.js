'use strict'

module.exports = async function (fastify, opts) {
    fastify.get('/branchs', async function (request, reply) {
        const Location = fastify.sequelize.model('Location');
        const LocationCoordinate = fastify.sequelize.model('LocationCoordinate');
        const LocationImage = fastify.sequelize.model('LocationImage');

        const branchs = await Location.findAll({
            where: {
                type: "branch",
                enabled: true,
            },
            include: [{
                model: LocationCoordinate,
                as: "coordinates",
                attributes: { exclude: ['locationId', 'updatedAt', 'createdAt'] },
            },{
                model: LocationImage,
                as: "images",
                attributes: { exclude: ['locationId', 'updatedAt', 'createdAt'] },
            }],
            attributes: { exclude: ['deletedAt', 'updatedAt', 'createdAt'] },
        })

        return reply.status(200).send(branchs);
    })
}
