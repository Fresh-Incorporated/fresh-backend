<div align="center" markdown>

<p align="center">
    <a href="https://github.com/Fresh-Incorporated/fresh-backend/blob/main/README.md"><b>ENGLISH</b></a> • 
    <u><b>РУССКИЙ</b></u>
</p>

**Этот проект — backend для minecraft IT-проекта FreshInc.**

[![Static Badge](https://img.shields.io/badge/public_group-white?style=social&logo=Telegram&logoColor=blue&logoSize=auto&labelColor=white&link=https%3A%2F%2Ft.me%2Funderzaralx)](https://t.me/underzaral)
![GitHub Repo stars](https://img.shields.io/github/stars/Fresh-Incorporated/fresh-backend)

</div>

# ✨ Возможности
- **📦 FreshMarket**
    > Уникальный маркетплейс, предоставляющий бизнес-логику для продажи, покупки и доставки товаров.

    > Система оформления и оплаты заказов.

    > Сборка заказов и доставка через систему Storage -> Pick-up Point.

- **📦 FreshCabinet**
    > Банковская система с поддержкой пополнения SPWorlds.

    > Система оформления и оплаты товаров.

# ⚙️ Установка и настройка

## Требования
- Аппаратное обеспечение:
    - OS: рекомендуется Debian
    - RAM: минимум 2 GB, рекомендуется 4 GB
    - CPU: минимум 1 core, рекомендуется 4 cores
    - Storage: 2 GB, минимум и рекомендовано

- Программное обеспечение:
    - [Docker](https://docs.docker.com/get-started/get-docker/)

    Установите Docker с помощью официального скрипта:
    ```
    sudo curl -fsSL https://get.docker.com | sh
    ```

    - [Postgres](https://www.postgresql.org/)
    
    Запустите Postgres в Docker
    ```
    version: "3.3"
    services:
      postgres:
        container_name: postgres
        restart: always
        env_file:
          - stack.env
        volumes:
          - /srv/database/postgres:/var/lib/postgresql/data
        image: postgres
        ports:
          - 5432:5432
    networks:
      default:
        ipam:
          config:
            - subnet: 172.30.0.0/16
    ```

> [!WARNING]
> **Для работы проекта также необходимо запустить backend**
> Руководство по установке backend смотрите [здесь](https://github.com/Fresh-Incorporated/fresh-backend)

## Шаг 1 – Загрузка репозитория

TODO

## Участие в разработке (Contributing)

Вклад сообщества — это то, что делает open source таким потрясающим местом для обучения, вдохновения и творчества. Любой ваш вклад **очень ценится**.

Если у вас есть предложение по улучшению проекта, сделайте fork репозитория и создайте pull request. Также вы можете просто открыть issue с тегом "enhancement".
Не забудьте поставить проекту звезду! Спасибо!

1. Сделайте Fork проекта
2. Создайте ветку с новой функциональностью (`git checkout -b feature/AmazingFeature`)
3. Зафиксируйте изменения (`git commit -m 'Add some AmazingFeature'`)
4. Отправьте изменения в ветку (`git push origin feature/AmazingFeature`)
5. Откройте Pull Request

<a href="https://github.com/Fresh-Incorporated/fresh-backend/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Fresh-Incorporated/fresh-backend" alt="contrib.rocks image" />
</a>

# 📄 Лицензия

Проект распространяется по лицензии **GNU Affero General Public License v3.0 (AGPL-3.0)**.

Вам разрешается:
- использовать, изучать и изменять исходный код;
- распространять оригинальные или изменённые версии;

При соблюдении следующих условий:
- исходный код любой изменённой версии **должен быть опубликован в открытом доступе**;
- изменённые версии должны распространяться **под той же лицензией (AGPL-3.0)**;
- уведомления об авторских правах и лицензии должны быть сохранены;
- если проект (или его изменённая версия) используется для предоставления сервиса по сети,
  пользователи этого сервиса должны иметь доступ к соответствующему исходному коду.

Проект предоставляется **«AS IS»**, без каких-либо гарантий.
Авторы не несут ответственности за любые убытки или проблемы, возникшие в результате использования проекта.

Полный текст лицензии смотрите в файле [LICENSE](./LICENSE).

Copyright © 2025-2026 zaralX

# 💸 Поддержка проекта

Любая поддержка помогает уделять больше времени разработке и ускорять развитие проекта!

> Российские и международные карты — [**Tribute**](https://t.me/tribute/app?startapp=dDuX)

> СБП, ЮMoney, SberPay, T-Pay — [**ЮKassa**](https://yookassa.ru/my/i/aV_CmfK_wqYS/l)

> USDT TRC-20 — **`TJKAPreXfNek1QmkgEfpjvkBrQn1NsBt7R`**
