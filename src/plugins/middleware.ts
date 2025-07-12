import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import crypto from 'crypto'

declare module 'fastify' {
    interface FastifyInstance {
        onlineUsers: () => string[]
    }
}

const onlineUsersPlugin: FastifyPluginAsync = async (fastify) => {
    const userActivityMap = new Map<string, number>()
    const THRESHOLD = 60 * 1000 // 60 секунд

    setInterval(() => {
        const now = Date.now()
        for (const [fingerprint, lastSeen] of userActivityMap.entries()) {
            if (now - lastSeen > THRESHOLD) {
                userActivityMap.delete(fingerprint)
            }
        }
    }, 30 * 1000)

    fastify.addHook('onRequest', async (request) => {
        const headers = request.headers
        const relevantHeaders = [
            headers['user-agent'] || '',
            headers['accept-language'] || '',
            headers['x-real-ip'] || headers['x-forwarded-for'] || '',
        ].join('|')

        const fingerprint = crypto.createHash('sha256').update(relevantHeaders).digest('hex')
        userActivityMap.set(fingerprint, Date.now())
    })

    const getOnlineUsers = (): string[] => {
        const now = Date.now()
        return [...userActivityMap.entries()]
            .filter(([_, ts]) => now - ts < THRESHOLD)
            .map(([fp]) => fp)
    }

    fastify.decorate('onlineUsers', getOnlineUsers)
}

export default fp(onlineUsersPlugin)
