import { FastifyPluginAsync } from 'fastify';
import { Location } from '../../models/Location';
import { LocationCoordinate } from '../../models/LocationCoordinate';
import { LocationImage } from '../../models/LocationImage';

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get('/branchs', async (request, reply) => {
    const branchs = await Location.findAll({
      where: {
        type: 'branch',
        enabled: true,
      },
      include: [
        {
          model: LocationCoordinate,
          as: 'coordinates',
          attributes: { exclude: ['locationId', 'updatedAt', 'createdAt'] },
        },
        {
          model: LocationImage,
          as: 'images',
          attributes: { exclude: ['locationId', 'updatedAt', 'createdAt'] },
        }
      ],
      attributes: { exclude: ['deletedAt', 'updatedAt', 'createdAt'] },
    });
    return reply.status(200).send(branchs);
  });
};

export default route;
