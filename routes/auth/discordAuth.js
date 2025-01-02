'use strict'

const DiscordOauth2 = require("discord-oauth2");
const { SPWorlds } = require('spworlds');

module.exports = async function (fastify, opts) {
  fastify.post('/discord/login', async function (request, reply) {
    const User = fastify.sequelize.model('User');
    checkAccount: try {
      const accessToken = request.cookies.access_token
      if (!accessToken) {
        break checkAccount;
      }

      const userJwtData = fastify.jwt.verify(accessToken)
      request.user = await User.findOne({where: {id: userJwtData.id}})
    } catch (err) {}
    const { code } = request.body;

    if (!code) {
      return reply.status(400).send({ message: 'Code is required' });
    }

    const oauth = new DiscordOauth2();

    try {
      // Получение токена Discord
      const discordTokens = await oauth.tokenRequest({
        clientId: process.env.DISCORD_ID,
        clientSecret: process.env.DISCORD_SECRET,
        code,
        scope: "identify",
        grantType: "authorization_code",
        redirectUri: process.env.DISCORD_REDIRECT,
      });

      const { access_token } = discordTokens;

      // Получение данных пользователя из Discord
      const discordUserData = await oauth.getUser(access_token);

      // Поиск пользователя по Discord ID
      let user = await User.findOne({ where: { discordId: discordUserData.id } });

      if (!user) {
        // Проверка доступности SPWorlds
        const spwApi = new SPWorlds({ id: process.env.SPW_ID, token: process.env.SPW_TOKEN })
        const pong = await spwApi.ping()

        if (!pong) {
          return reply.status(500).send({ message: 'SPWorlds API не доступен. Попробуйте позже.' });
        }

        const { username, uuid } = await spwApi.findUser(discordUserData.id);

        // Создаем нового пользователя
        user = await User.create({
          discordId: discordUserData.id,
          nickname: username,
          uuid: uuid,
        });
      }

      // Генерация токенов
      const tokens = {
        access_token: fastify.jwt.sign({ id: user.id, discordId: user.discordId }, { expiresIn: '15m' }),
        refresh_token: fastify.jwt.sign({ id: user.id, discordId: user.discordId }, { expiresIn: '30d' }),
      };

      // Установка куков
      reply.setCookie("access_token", tokens.access_token, {
        maxAge: 60 * 15,
        path: '/',
        httpOnly: true,
        secure: true,
      });

      reply.setCookie("refresh_token", tokens.refresh_token, {
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
        httpOnly: true,
        secure: true,
      });

      // Возврат данных
      return reply.status(200).send({
        user,
        tokens,
        message: "Успешный вход через Discord!",
      });
    } catch (error) {
      console.error("Discord OAuth Error:", error.response?.data || error.message);
      fastify.log.error(error);
      return reply.status(500).send({ message: 'Ошибка авторизации через Discord' });
    }
  });
};
