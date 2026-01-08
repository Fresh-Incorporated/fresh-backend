import { FastifyPluginAsync } from 'fastify'

const route: FastifyPluginAsync = async function (fastify, opts) {
  fastify.get('/', async function (request, reply) {
    return "Что ты тут забыл??? Ну ка вылезай, тебе здесь нечего делать"
  })

  fastify.get('/license', async function (request, reply) {
    return {
      "name": "Fresh Backend",
      "license": "AGPL-3.0",
      "source": "https://github.com/Fresh-Incorporated/fresh-backend"
    }
  })

  fastify.get('/stats', async function (request, reply) {
    const User = fastify.sequelize.model('User');

    const users = await User.count()
    return {
      online: fastify.onlineUsers()?.length,
      users: users,
    }
  })
}

export default route;
