'use strict'

const DiscordOauth2 = require("discord-oauth2");

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
        scope: "identify email",
        grantType: "authorization_code",
        redirectUri: process.env.DISCORD_REDIRECT,
      });

      const { access_token } = discordTokens;

      // Получение данных пользователя из Discord
      const discordUserData = await oauth.getUser(access_token);

      if (!discordUserData.verified) {
        return reply.status(400).send({ message: 'Email в Discord не подтвержден' });
      }

      // Поиск пользователя по Discord ID
      let user = await User.findOne({ where: { discordId: discordUserData.id } });

      if (!user) {
        // Ищем аккаунт для привязки
        user = await User.findOne({ where: { id: request?.user?.id ?? -1 } });

        // Создаем нового пользователя
        user = await User.create({
          discordId: discordUserData.id,
          email: discordUserData.email,
          username: discordUserData.username,
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
