'use strict'

const { uploadToS3 } = require("../../../utils/s3Util");
const {notifyWorkers} = require("../../../utils/notifyUtil");
module.exports = async function (fastify, opts) {
    fastify.post('/create', { preHandler: fastify.requireAuth }, async function (request, reply) {
        const User = fastify.sequelize.model('User');
        const Shop = fastify.sequelize.model('Shop');
        const ShopHistory = fastify.sequelize.model('ShopHistory');
        const BalanceHistory = fastify.sequelize.model('BalanceHistory');

        if (request.query.name.length < 3 || request.query.name.length > 16) {
            return reply.status(400).send({
                message: "Длинна названия должна быть в пределах 3-16 символов."
            });
        }

        if (request.query.description.length > 240) {
            return reply.status(400).send({
                message: "Длинна описания должна быть не более 240 символов."
            });
        }

        const shops_count = await Shop.count({ where: { ownerId: request.user.id } });

        const price = 16 + 64 * shops_count;

        if (request.user.balance < price) {
            return reply.status(402).send({ message: "Недостаточно средств. Не хватает: " + (price - request.user.balance) });
        }

        let fileUrl = process.env.DEFAULT_SHOP_ICON; // Путь по умолчанию

        try {
            // Проверка на наличие загруженного файла
            const buffer = await request.body.icon.toBuffer();
            const file = {
                filename: request.body.icon.filename,
                mimetype: request.body.icon.mimetype,
                size: buffer.length,
                buffer: buffer,
            }

            if (file.size > 2 * 1024 * 1024) {
                return reply.status(400).send({ message: 'Иконка должна быть не более 2 МБ!' })
            }
            if (file) {
                const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];
                if (!allowedMimeTypes.includes(file.mimetype)) {
                    return reply.status(400).send({ message: 'Допускаются только изображения форматов JPEG, JPG, PNG, SVG или WEBP.' });
                }
                // Загрузка файла в S3
                fileUrl = await uploadToS3(file, process.env.S3_BUCKET_NAME, 'fresh/market/shop_icon', true);
            }
        } catch (err) {
            console.warn('Файл не был загружен, используется иконка по умолчанию.');
        }

        try {
            const newShop = await Shop.create({
                ownerId: request.user.id,
                name: request.query.name,
                description: request.query.description,
                icon: fileUrl,
            });

            await request.user.decrement({ balance: price });

            await ShopHistory.create({
                action_type: "created",
                userId: request.user.id, // Тот кто создал магазин
                shopId: newShop.id,
                data: {
                    name: newShop.name,
                    description: newShop.description,
                    products_limit: newShop.products_limit,
                },
            })

            await BalanceHistory.create({
                action_type: "freshmarket_pay",
                message: "Покупка магазина FreshMarket",
                userId: request.user.id,
                value: -price,
            })

            notifyWorkers(fastify, 3, "fm_secretary_shop", "Новая проверка", "Проверьте магазин", "/cabinet/freshmarket/work/secretary/verify/shops")

            return reply.status(200).send({
                message: 'Магазин успешно создан.',
                shop: newShop,
            });
        } catch (err) {
            console.error(err);
            return reply.status(500).send({ message: 'Ошибка при создании магазина.' });
        }
    });
};
