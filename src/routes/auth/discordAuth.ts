import { FastifyPluginAsync } from 'fastify';
import DiscordOauth2 from 'discord-oauth2';
import { SPWorlds } from 'spworlds';
import { User } from '../../models/User';

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post<{ Body: { code?: string } }>('/discord/login', async (request, reply) => {
    // Проверка авторизации по access_token
    try {
      const accessToken = request.cookies.access_token;
      if (accessToken) {
        try {
          const userJwtData = fastify.jwt.verify(accessToken) as { id: number };
          (request as any).user = await User.findOne({ where: { id: userJwtData.id } });
        } catch {}
      }
    } catch {}
    const { code } = request.body;
    if (!code) {
      return reply.status(400).send({ message: 'Code is required' });
    }
    const oauth = new DiscordOauth2();
    try {
      // Получение токена Discord
      const discordTokens = await oauth.tokenRequest({
        clientId: process.env.DISCORD_ID || '',
        clientSecret: process.env.DISCORD_SECRET || '',
        code,
        scope: 'identify',
        grantType: 'authorization_code',
        redirectUri: process.env.DISCORD_REDIRECT || '',
      });
      const { access_token } = discordTokens;
      // Получение данных пользователя из Discord
      const discordUserData = await oauth.getUser(access_token);
      // Поиск пользователя по Discord ID
      let user = await User.findOne({ where: { discordId: discordUserData.id } });
      if (!user) {
        // Проверка доступности SPWorlds
        const spwApi = new SPWorlds({ id: process.env.SPW_ID || '', token: process.env.SPW_TOKEN || '' });
        try {
          const pong = await spwApi.ping();
          if (!pong) {
            return reply.status(500).send({ message: 'SPWorlds API не доступен. Попробуйте позже.' });
          }
        } catch (err) {
          return reply.status(500).send({ message: 'SPWorlds API не доступен. Попробуйте позже.' });
        }
        try {
          const spwUser = await spwApi.findUser(discordUserData.id);
          if (spwUser == null) {
            return reply.status(400).send({ message: 'Не получилось найти аккаунт SPWorlds' });
          }

          const { username, uuid } = spwUser

          user = await User.findOne({
            where: {
              uuid: uuid
            }
          })

          if (user) {
            user.discordId = discordUserData.id
            user.nickname = username
            await user.save()
          } else {
            // Создаем нового пользователя
            user = await User.create({
              discordId: discordUserData.id,
              nickname: username,
              uuid: uuid,
            } as any);
          }
        } catch (err) {
          console.log(err);
          return reply.status(500).send({ message: 'Не получилось найти аккаунт SPWorlds' });
        }
      }
      // Генерация токенов
      const tokens = {
        access_token: fastify.jwt.sign({ id: user.id, discordId: Number(user.discordId) || 0 }, { expiresIn: '15m' }),
        refresh_token: fastify.jwt.sign({ id: user.id, discordId: Number(user.discordId) || 0 }, { expiresIn: '30d' }),
      };
      // Установка куков
      reply.setCookie('access_token', tokens.access_token, {
        maxAge: 60 * 15,
        path: '/',
        httpOnly: true,
        secure: true,
      });
      reply.setCookie('refresh_token', tokens.refresh_token, {
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
        httpOnly: true,
        secure: true,
      });
      // Возврат данных
      return reply.status(200).send({
        user,
        tokens,
        message: 'Успешный вход через Discord!',
      });
    } catch (error: any) {
      console.error('Discord OAuth Error:', error.response?.data || error.message);
      fastify.log.error(error);
      return reply.status(500).send({ message: 'Ошибка авторизации через Discord' });
    }
  });
};

export default route;
