import fp from 'fastify-plugin'
import fastifyRateLimit, { FastifyRateLimitOptions } from '@fastify/rate-limit'

export default fp<FastifyRateLimitOptions>(async (fastify) => {
    fastify.register(fastifyRateLimit, {
        max: 100,
        timeWindow: '1 minute',
        keyGenerator: (request) => {
            if (request.user && typeof request.user.id !== 'undefined') {
                return String(request.user.id)
            }

            const ip = request.headers['x-real-ip'] || request.ip
            return typeof ip === 'string' ? ip : 'unknown-ip'
        },
    })
})
