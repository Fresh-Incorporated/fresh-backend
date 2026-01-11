/*
 * Copyright © 2024–2026 zaralX
 * Licensed under the GNU Affero General Public License v3.0
 */
import AutoLoad, { AutoloadPluginOptions } from '@fastify/autoload'
import { FastifyPluginAsync, FastifyServerOptions } from 'fastify'
import fs from 'fs'
import { join } from 'path'

export interface AppOptions extends FastifyServerOptions, Partial<AutoloadPluginOptions> {}

const options: AppOptions = {}

const app: FastifyPluginAsync<AppOptions> = async (
    fastify,
    opts
): Promise<void> => {

  const dir = join(__dirname, 'uploads');
  fs.mkdirSync(dir, { recursive: true });

  void fastify.register(AutoLoad, {
    dir: join(__dirname, 'plugins'),
    options: Object.assign({}, opts)
  })

  void fastify.register(AutoLoad, {
    dir: join(__dirname, 'routes'),
    routeParams: true,
    options: Object.assign({}, opts)
  })

  fastify.setErrorHandler(function (error: any, request, reply) {
    if (error.statusCode === 429) {
      return reply.code(429).send({ message: 'Превышен лимит скорости. Попробуйте позже.'})
    }
    return reply.send(error)
  })

  fastify.addHook('onSend', async (_request, reply, payload) => {
    reply.header(
        'X-Source-Code',
        'https://github.com/Fresh-Incorporated/fresh-backend'
    )
    return payload
  })
}

export default app;
export { app, options }