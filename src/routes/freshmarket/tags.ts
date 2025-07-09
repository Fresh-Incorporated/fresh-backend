import { FastifyPluginAsync } from 'fastify';
import { Tag } from '../../models/Tag';

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get('/tags', async (request, reply) => {
    const tags = await Tag.findAll();
    return reply.status(200).send(tags);
  });
};

export default route;
