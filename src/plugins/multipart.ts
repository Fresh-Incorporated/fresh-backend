import fp from 'fastify-plugin'
import fastifyMultipart, {FastifyMultipartOptions} from "@fastify/multipart";

/**
 * A multipart support
 *
 * @see https://github.com/fastify/fastify-multipart
 */
export default fp<FastifyMultipartOptions>(async (fastify) => {
    fastify.register(fastifyMultipart, {
        attachFieldsToBody: true,
        limits: {
            fileSize: 10 * 1024 * 1024
        }
    })
})
