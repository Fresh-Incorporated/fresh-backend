import type {FastifyInstance} from "fastify";
import {loadMap} from "./mapLoader";
import {PWPixel} from "../models/PWPixel";

async function start(fastifyInstance: FastifyInstance): Promise<void> {
    if (await PWPixel.count() == 0) {
        await loadMap();
    }
}

export { start }
