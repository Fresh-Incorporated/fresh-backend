import fp from 'fastify-plugin'
import fastifyWebsocket from '@fastify/websocket'

/**
 * WebSocket support for Fastify
 *
 * @see https://github.com/fastify/fastify-websocket
 */
export default fp(async (fastify) => {
  fastify.register(fastifyWebsocket, {
    options: {
      maxPayload: 1048576, // 1MB
    }
  })
}) 