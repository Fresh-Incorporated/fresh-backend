'use strict'

const { uploadToS3 } = require("../../../utils/s3Util");
module.exports = async function (fastify, opts) {
    fastify.addHook('onRequest', async (request, reply) => {
        try {
            const accessToken = request.cookies.access_token;
            if (!accessToken) {
                return reply.status(401).send({ error: 'Missing access token' });
            }

            request.user = fastify.jwt.verify(accessToken);
        } catch (err) {
            reply.status(401).send({ error: 'Unauthorized' });
        }
    });

    fastify.post('/create', async function (request, reply) {
        const User = fastify.sequelize.model('User');
        const Shop = fastify.sequelize.model('Shop');

        const user = await User.findOne({
            where: {
                id: request.user.id
            },
            attributes: { exclude: ['updatedAt'] },
        });

        if (!user) {
            return reply.status(400).send({
                message: "Пользователь не найден."
            });
        }

        const shops = await Shop.findAll({ where: { ownerId: request.user.id } });

        const price = 16 + Math.pow(16, shops.length) * shops.length;

        if (user.balance < price) {
            return reply.status(402).send({ message: "Недостаточно средств. Не хватает: " + (price - user.balance) });
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
                const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg'];
                if (!allowedMimeTypes.includes(file.mimetype)) {
                    return reply.status(400).send({ message: 'Допускаются только изображения форматов JPEG, JPG или PNG.' });
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

            await user.decrement({ balance: price });

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
