import fp from 'fastify-plugin'
import fastifyJwt, {FastifyJWTOptions} from "@fastify/jwt";

/**
 * JWT utils for Fastify
 *
 * @see https://github.com/fastify/fastify-jwt
 */
export default fp<FastifyJWTOptions>(async (fastify) => {
  fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET as string,
  })
})
