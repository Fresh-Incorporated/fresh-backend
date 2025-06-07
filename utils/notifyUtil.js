
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

const {Op} = require("sequelize");

function buildNotification({ title, body, tag, url }) {
    return {
        title,
        options: {
            body,
            icon: "/logo.png",
            badge: "/logo.png",
            vibrate: [200, 100, 200],
            timestamp: Date.now(),
            lang: "ru-RU",
            dir: "auto",
            tag,
            data: {
                url: `${process.env.FRONTEND_URL}${url}`,
            }
        }
    };
}

/**
 * Отправляет уведомление конкретному пользователю
 */
async function notifyUser(fastify, userId, tag, title, body, url = "/") {
    const UserWebpush = fastify.sequelize.model("UserWebpush");

    const subscriptions = await UserWebpush.findAll({
        where: {
            userId: userId,
            enabled: true
        }
    });

    const payload = JSON.stringify(buildNotification({ title, body, tag, url }));

    await Promise.allSettled(
        subscriptions.map(sub =>
            fastify.webpush.sendNotification(sub.data, payload)
        )
    ).then(results => {
        for (const result of results) {
            if (result.status === "rejected") {
                console.error("Push error:", result.reason);
            }
        }
    });
}

// 0 < fm_worker < 5 (delivery - 1, logic - 2, secretary - 3, director - 4)
async function notifyWorkers(fastify, minFmWorker, tag, title, body, url = "/") {
    const User = fastify.sequelize.model("User");

    const users = await User.findAll({
        where: {
            fm_worker: {
                [Op.gte]: minFmWorker
            }
        }
    });

    for (const user of users) {
        await notifyUser(fastify, user.id, tag, title, body, url);
    }
}

module.exports = {
    notifyUser,
    notifyWorkers
};