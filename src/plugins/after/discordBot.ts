import fp from 'fastify-plugin';
import {FastifyInstance} from "fastify";
import {startBot} from "../../bots/discord/bot";

/**
 * Loads discord bot
 */
export default fp(async function (fastify: FastifyInstance) {
    await startBot(fastify)
});
