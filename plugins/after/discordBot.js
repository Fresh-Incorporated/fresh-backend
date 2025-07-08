const fp = require('fastify-plugin');
const {startBot} = require("../../bots/discord/bot");

/**
 * Loads discord bot
 */
module.exports = fp(async (fastify, opts) => {
    await startBot(fastify)
});
