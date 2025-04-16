'use strict'

module.exports = async function (fastify, opts) {
  fastify.get('/', async function (request, reply) {
    return "Что ты тут забыл??? Ну ка вылезай, тебе здесь нечего делать"
  })
}
