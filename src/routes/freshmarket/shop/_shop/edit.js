'use strict'

const { uploadToS3 } = require("../../../../utils/s3Util");
const {notifyWorkers} = require("../../../../utils/notifyUtil");
module.exports = async function (fastify, opts) {
    fastify.post('/edit', { preHandler: fastify.requireShopAccess }, async function (request, reply) {
        request.assertShopPermission('edit_shop_info')

        const Shop = fastify.sequelize.model('Shop');
        const ShopHistory = fastify.sequelize.model('ShopHistory');

        if (request.shop.verify_status === 0) {
            return reply.status(400).send({
                message: "Ваш магазин ещё не успел пройти прошлую проверку! Дождитесь её завершения и попробуйте снова. "
            });
        }

        if (request.query.name && (request.query.name.length < 3 || request.query.name.length > 16)) {
            return reply.status(400).send({
                message: "Длина названия должна быть в пределах 3-16 символов."
            });
        }

        if (request.query.tag) {
            if (request.query.tag.length < 3 || request.query.tag.length > 32) {
                return reply.status(400).send({
                    message: "Длина тега магазина должна быть в пределах 3-32 символов."
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

        if (await Shop.findOne({ where: { tag: request.query.tag }} ) && request.shop.tag !== request.query.tag) {
            return reply.status(400).send({
                message: "Тег магазина уже занят!"
            });
        }

        if (request.query.description && (request.query.description.length > 240)) {
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
                userId: request.user.id,
                shopId: request.shop.id,
                data: changes,
            })

            await ShopHistory.create({
                action_type: "recheck",
                userId: request.user.id,
                shopId: request.shop.id,
            })

            notifyWorkers(fastify, 3, "fm_secretary_shop", "Новая проверка", "Проверьте магазин", "/cabinet/freshmarket/work/secretary/verify/shops")

            return reply.status(200).send({
                message: 'Магазин успешно отправлен на проверку!',
                shop: currentShop,
            });
        } catch (err) {
            console.error(err);
            return reply.status(500).send({ message: 'Ошибка при изменении магазина.' });
        }
    });
};
