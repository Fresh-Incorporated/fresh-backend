import { FastifyPluginAsync } from 'fastify';

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post('/refresh', async (request, reply) => {
    try {
      const refreshToken = request.cookies.refresh_token;
      if (!refreshToken) {
        return reply.status(400).send({ error: 'Missing refresh token' });
      }
      const decoded = fastify.jwt.verify(refreshToken) as { id: number; discordId?: number };
      const accessToken = fastify.jwt.sign({ id: decoded.id, discordId: decoded.discordId ?? 0 }, { expiresIn: '15m' });
      reply.setCookie('access_token', accessToken, {
        maxAge: 60 * 10,
        path: '/'
      });
      return reply.status(200).send();
    } catch (err) {
      return reply.status(401).send({ error: 'Invalid refresh token' });
    }
  });

  fastify.post('/logout', async (request, reply) => {
    reply.clearCookie('access_token', {
      path: '/'
    });
    reply.clearCookie('refresh_token', {
      path: '/'
    });
    return reply.status(200).send();
  });
};

export default route;
