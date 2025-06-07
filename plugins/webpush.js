'use strict'

const fp = require('fastify-plugin');
const webpush = require("web-push");

async function plugin(fastify, options) {
    if (!process.env.WEB_PUSH_PRIVATE || !process.env.WEB_PUSH_PUBLIC) {
        const vapidKeys = webpush.generateVAPIDKeys();
        throw new Error(`Not found .env WEB_PUSH_PRIVATE and WEB_PUSH_PUBLIC. 
    You can use: 
    WEB_PUSH_PRIVATE=${vapidKeys.privateKey}
    WEB_PUSH_PUBLIC=${vapidKeys.publicKey}`)
    }

    webpush.setVapidDetails(
        'mailto:admin@zaralx.ru',
        process.env.WEB_PUSH_PUBLIC,
        process.env.WEB_PUSH_PRIVATE
    )

    fastify.decorate('webpush', webpush);
}

module.exports = fp(plugin);