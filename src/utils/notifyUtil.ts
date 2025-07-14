
/*
{
  title: "Test уведомление",
  options: {
    body: "Привет! Это тестовое уведомление.",
    icon: "/icons/icon-192.png",                    // Основная иконка
    badge: "/icons/badge-72.png",                   // Маленькая иконка (в панели)
    image: "/images/banner.png",                    // Большое изображение в теле уведомления
    vibrate: [200, 100, 200],                        // Паттерн вибрации (на мобильных)
    sound: "/sounds/notify.mp3",                    // ⚠️ Поддержка ограничена
    timestamp: Date.now(),                          // Метка времени
    dir: "auto",                                    // Направление текста: 'auto', 'ltr', 'rtl'
    lang: "ru-RU",                                  // Язык уведомления
    tag: "test-notification",                       // Используется для замены уведомлений с тем же тегом
    renotify: true,                                 // Повторно уведомлять при одинаковом теге
    requireInteraction: false,                      // Требует взаимодействия для закрытия
    silent: false,                                  // Не издавать звук
    actions: [                                      // Действия (кнопки)
      {
        action: "open_url",
        title: "Открыть",
        icon: "/icons/open.png"
      },
      {
        action: "dismiss",
        title: "Скрыть",
        icon: "/icons/close.png"
      }
    ],
    data: {
      url: "https://fresh.zaralx.ru/cabinet",       // Данные, доступные в service worker
      custom: {
        userId: 123,
        trackingId: "abc-456"
      }
    }
  }
}
 */

import { FastifyInstance } from 'fastify';
import { Op } from 'sequelize';
import { UserWebpush } from '../models/UserWebpush';
import { User } from '../models/User';
import { NotificationSettings } from '../models/NotificationSettings';
import {v4 as uuidv4} from "uuid";

interface NotificationPayload {
    title: string;
    body: string;
    url: string;
}

const DEFAULT_ICON = '/logo.png';

function buildNotification({ title, body, url }: NotificationPayload) {
    return {
        title,
        options: {
            body,
            icon: DEFAULT_ICON,
            badge: DEFAULT_ICON,
            vibrate: [200, 100, 200],
            timestamp: Date.now(),
            lang: 'ru-RU',
            dir: 'auto',
            tag: uuidv4(),
            data: {
                url: `${process.env.FRONTEND_URL}${url}`,
            },
        },
    };
}

export type NotificationPermissionKey = 'market_shop' | 'market_delivered' | 'market_work' | 'priority';
type Target = 'webpush' | 'discord';

export async function notifyUser(
    fastify: FastifyInstance,
    userId: number,
    title: string,
    body: string,
    url = '/',
    permission: NotificationPermissionKey | null
): Promise<void> {
    const settingsList = await NotificationSettings.findAll({
        where: { userId },
    });

    const settingsByTarget: Partial<Record<Target, NotificationSettings>> = {};
    for (const setting of settingsList) {
        settingsByTarget[setting.target as Target] = setting;
    }

    // === Webpush ===
    if (permission == null || settingsByTarget.webpush?.[permission]) {
        const subscriptions = await UserWebpush.findAll({
            where: { userId, enabled: true },
        });

        const payload = JSON.stringify(buildNotification({ title, body, url }));

        const results = await Promise.allSettled(
            subscriptions.map((sub) => fastify.webpush.sendNotification(sub.data, payload))
        );

        for (const result of results) {
            if (result.status === 'rejected') {
                console.error('Push error:', result.reason);
            }
        }
    }

    // === Discord ===
    if (permission == null || settingsByTarget.discord?.[permission]) {
        const user = await User.findOne({
            where: { id: userId },
            attributes: ['id', 'discordId'],
        });

        if (user?.discordId && fastify.discordBot.guild) {
            try {
                const guildMember = await fastify.discordBot.guild.members.fetch(user.discordId);
                const dm = await guildMember.createDM();
                await dm.send({
                    embeds: [
                        {
                            title,
                            description: body,
                            url: `${process.env.FRONTEND_URL}${url}`,
                            color: 0x0099ff,
                            timestamp: new Date().toISOString(),
                        },
                    ],
                });
            } catch (err) {
                console.error(`Ошибка отправки Discord DM пользователю ${user.discordId}:`, err);
            }
        }
    }
}

export async function notifyWorkers(
    fastify: FastifyInstance,
    minFmWorker: number,
    title: string,
    body: string,
    url = '/',
): Promise<void> {
    const users = await User.findAll({
        where: { fm_worker: { [Op.gte]: minFmWorker } },
        attributes: ['id'],
    });

    await Promise.allSettled(
        users.map((user) => notifyUser(fastify, user.id, title, body, url, 'market_work'))
    );
}
