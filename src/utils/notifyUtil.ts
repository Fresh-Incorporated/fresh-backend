
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
import {UserWebpush} from "../models/UserWebpush";
import {User} from "../models/User";

interface NotificationPayload {
    title: string;
    body: string;
    tag: string;
    url: string;
}

function buildNotification({ title, body, tag, url }: NotificationPayload) {
    return {
        title,
        options: {
            body,
            icon: '/logo.png',
            badge: '/logo.png',
            vibrate: [200, 100, 200],
            timestamp: Date.now(),
            lang: 'ru-RU',
            dir: 'auto',
            tag,
            data: {
                url: `${process.env.FRONTEND_URL}${url}`,
            },
        },
    };
}

export async function notifyUser(
    fastify: FastifyInstance,
    userId: number,
    tag: string,
    title: string,
    body: string,
    url = '/'
): Promise<void> {
    const subscriptions: UserWebpush[] = await UserWebpush.findAll({
        where: {
            userId,
            enabled: true,
        },
    });

    const payload = JSON.stringify(buildNotification({ title, body, tag, url }));

    const results = await Promise.allSettled(
        subscriptions.map((sub) => fastify.webpush.sendNotification(sub.data, payload))
    );

    for (const result of results) {
        if (result.status === 'rejected') {
            console.error('Push error:', result.reason);
        }
    }
}

export async function notifyWorkers(
    fastify: FastifyInstance,
    minFmWorker: number,
    tag: string,
    title: string,
    body: string,
    url = '/'
): Promise<void> {
    const users: { id: number; fm_worker: number }[] = await User.findAll({
        where: {
            fm_worker: {
                [Op.gte]: minFmWorker,
            },
        },
    });

    for (const user of users) {
        await notifyUser(fastify, user.id, tag, title, body, url);
    }
}
