import fp from 'fastify-plugin'
import fastifyCookie, {FastifyCookieOptions} from "@fastify/cookie";

/**
 * This plugins adds some utilities for cookies
 *
 * @see https://github.com/fastify/fastify-cookie
 */
export default fp<FastifyCookieOptions>(async (fastify) => {
  fastify.register(fastifyCookie, {
    secret: process.env.COOKIE_SECRET as string,
    hook: 'onRequest',
    parseOptions: {}
  })
})
