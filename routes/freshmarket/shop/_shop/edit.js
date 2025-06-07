'use strict'

const { uploadToS3 } = require("../../../../utils/s3Util");
const {notifyWorkers} = require("../../../../utils/notifyUtil");
module.exports = async function (fastify, opts) {
    fastify.addHook('onRequest', async (request, reply) => {
        try {
            const accessToken = request.cookies.access_token;
            const Shop = fastify.sequelize.model('Shop');
            if (!accessToken) {
                return reply.status(401).send({ error: 'Missing access token' });
            }

            request.user = fastify.jwt.verify(accessToken);

            const shop = await Shop.findOne({ where: { id: request.params.shop, ownerId: request.user.id }, attributes: ['id', 'name', 'description', 'icon', 'tag', 'verify_status'] });

            if (!shop) {
                return reply.status(400).send({
                    message: "Магазин не существует или у вас недостаточно прав."
                });
            }

            if (shop.verify_status === 0) {
                return reply.status(400).send({
                    message: "Ваш магазин ещё не успел пройти прошлую проверку! Дождитесь её завершения и попробуйте снова. "
                });
            }

            request.shop = shop
        } catch (err) {
            reply.status(401).send({ error: 'Unauthorized' });
        }
    });

    fastify.post('/edit', async function (request, reply) {
        const User = fastify.sequelize.model('User');
        const Shop = fastify.sequelize.model('Shop');
        const ShopHistory = fastify.sequelize.model('ShopHistory');

        const user = await User.findOne({
            where: {
                id: request.user.id
            },
            attributes: ['id'],
        });

        if (!user) {
            return reply.status(400).send({
                message: "Пользователь не найден."
            });
        }

        if (request.query.name && (request.query.name < 3 || request.query.name > 16)) {
            return reply.status(400).send({
                message: "Длина названия должна быть в пределах 3-16 символов."
            });
        }

        if (request.query.tag) {
            if (request.query.tag.length < 3 || request.query.tag.length > 16) {
                return reply.status(400).send({
                    message: "Длина тега магазина должна быть в пределах 3-16 символов."
                });
            }

            // Проверка на допустимые символы (только английские буквы и цифры)
            if (!/^[a-zA-Z0-9]+$/.test(request.query.tag)) {
                return reply.status(400).send({
                    message: "Тег магазина может содержать только английские буквы и цифры."
                });
            }

            request.query.tag = request.query.tag.toLowerCase();
        }

        if (request.query.description && (request.query.description > 240)) {
            return reply.status(400).send({
                message: "Длина описания должна быть не более 240 символов."
            });
        }

        let fileUrl = process.env.DEFAULT_SHOP_ICON;

        try {
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

                fileUrl = await uploadToS3(file, process.env.S3_BUCKET_NAME, 'fresh/market/shop_icon', true);
            }
        } catch (err) {
            console.warn('Файл не был загружен, используется иконка по умолчанию.');
        }

        try {
            const changes = {
                verify_status: 0
            }
            if (request.query.name && request.shop.name !== request.query.name) {
                changes.name = request.query.name;
            }
            if (request.query.description && request.shop.description !== request.query.description) {
                changes.description = request.query.description;
            }
            if (request.query.tag && request.shop.tag !== request.query.tag) {
                changes.tag = request.query.tag;
            }
            if (fileUrl !== process.env.DEFAULT_SHOP_ICON) {
                changes.icon = fileUrl;
            }
            const currentShop = await Shop.update(changes, {
                where: {
                    id: request.shop.id
                }
            });

            await ShopHistory.create({
                action_type: "edited",
                userId: user.id,
                shopId: currentShop.id,
                data: changes,
            })

            await ShopHistory.create({
                action_type: "recheck",
                userId: user.id,
                shopId: currentShop.id,
            })

            notifyWorkers(fastify, 3, "fm_secretary_shop", "Новая проверка", "Проверьте магазин", "/freshmarket/work/secretary/verify_shops")

            return reply.status(200).send({
                message: 'Магазин успешно отправлен на проверку!',
                shop: currentShop,
            });
        } catch (err) {
            console.error(err);
            return reply.status(500).send({ message: 'Ошибка при создании магазина.' });
        }
    });
};
