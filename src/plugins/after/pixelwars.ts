import fp from 'fastify-plugin';
import {FastifyInstance} from "fastify";
import {start} from "../../pixelwars/main";

/**
 * Loads discord bot
 */
export default fp(async function (fastify: FastifyInstance) {
    new Promise(() => start(fastify))
});
