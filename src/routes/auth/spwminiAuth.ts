import { FastifyPluginAsync } from 'fastify';
import { User } from '../../models/User';
import {UserData} from "spwmini/types";
import {checkUser} from "spwmini/middleware";

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post<{ Body: { user?: UserData } }>('/spwmini/login', async (request, reply) => {
    if (!request.body.user)
      return reply.status(400).send({ message: "Invalid user provided" });

    const valid = checkUser(request.body.user, process.env.SPW_MINI_TOKEN as string)

    if (!valid)
      return reply.status(400).send({ message: "Invalid user provided" });

    const { username, minecraftUUID } = request.body.user

    let user = await User.findOne({ where: { uuid: minecraftUUID } });
    if (!user) {
      try {
        // Создаем нового пользователя
        user = await User.create({
          discordId: null,
          nickname: username,
          uuid: minecraftUUID,
        } as any);
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

    reply.send({ valid: valid, tokens })
  });
};

export default route;
