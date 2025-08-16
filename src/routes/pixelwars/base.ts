import { FastifyPluginAsync } from 'fastify'
import {PWPixel} from "../../models/PWPixel";

const route: FastifyPluginAsync = async function (fastify, opts) {
    fastify.get('/map', async function (request, reply) {
        return {
            borderPixels: await PWPixel.findAll({
                where: {
                    type: "border"
                },
                raw: true
            }),
            statePixels: await PWPixel.findAll({
                where: {
                    type: "state"
                },
                raw: true
            })
        }
    })
}

export default route;
