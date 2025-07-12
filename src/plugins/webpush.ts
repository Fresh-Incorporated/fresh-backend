import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import webpush from 'web-push'

declare module 'fastify' {
    interface FastifyInstance {
        webpush: typeof webpush
    }
}

const webpushPlugin: FastifyPluginAsync = async (fastify) => {
    const { WEB_PUSH_PRIVATE, WEB_PUSH_PUBLIC } = process.env

    if (!WEB_PUSH_PRIVATE || !WEB_PUSH_PUBLIC) {
        const vapidKeys = webpush.generateVAPIDKeys()
        throw new Error(`Не найдены переменные окружения WEB_PUSH_PRIVATE и WEB_PUSH_PUBLIC.
Вы можете использовать следующие значения:
WEB_PUSH_PRIVATE=${vapidKeys.privateKey}
WEB_PUSH_PUBLIC=${vapidKeys.publicKey}`)
    }

    webpush.setVapidDetails(
        'mailto:admin@zaralx.ru',
        WEB_PUSH_PUBLIC,
        WEB_PUSH_PRIVATE
    )

    fastify.decorate('webpush', webpush)
}

export default fp(webpushPlugin)
