'use strict'

const {uploadToS3} = require("../../../../../../utils/s3Util");
module.exports = async function (fastify, opts) {
    fastify.addHook('onRequest', async (request, reply) => {
        try {
            const accessToken = request.cookies.access_token;
            const Shop = fastify.sequelize.model('Shop');
            const Product = fastify.sequelize.model('Product');
            if (!accessToken) {
                return reply.status(401).send({error: 'Missing access token'});
            }

            request.user = fastify.jwt.verify(accessToken);

            const shop = await Shop.findOne({
                where: {id: request.params.shop, ownerId: request.user.id},
                attributes: ['id', 'name', 'description', 'icon', 'tag', 'verify_status']
            });

            if (!shop) {
                return reply.status(400).send({
                    message: "Магазин не существует или у вас недостаточно прав."
                });
            }

            request.shop = shop

            const product = await Product.findOne({where: {shopId: request.shop.id, id: request.params.product}});

            if (product.verify_status === 0) {
                return reply.status(400).send({
                    message: "Товар ещё не успел пройти прошлую проверку! Дождитесь её завершения и попробуйте снова. "
                });
            }

            if (product.refill_status !== 0) {
                return reply.status(400).send({
                    message: "Нельзя изменить товар который пополняется. "
                });
            }

            request.product = product
        } catch (err) {
            reply.status(401).send({error: 'Unauthorized'});
        }
    });

    fastify.post('/edit', async function (request, reply) {
        const User = fastify.sequelize.model('User');
        const Product = fastify.sequelize.model('Product');
        const ProductHistory = fastify.sequelize.model('ProductHistory');

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

        if (request.query.name && (request.query.name < 3 || request.query.name > 24)) {
            return reply.status(400).send({
                message: "Длина названия должна быть в пределах 3-24 символов."
            });
        }

        if (request.query.description && (request.query.description > 240)) {
            return reply.status(400).send({
                message: "Длина описания должна быть не более 240 символов."
            });
        }

        if (request.query.price && (parseInt(request.query.price) < 1 || parseInt(request.query.price) > 1728)) {
            return reply.status(400).send({
                message: "Цена товара должна быть от 1 до 1728."
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
                return reply.status(400).send({message: 'Иконка должна быть не более 2 МБ!'})
            }
            if (file) {
                const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg'];
                if (!allowedMimeTypes.includes(file.mimetype)) {
                    return reply.status(400).send({message: 'Допускаются только изображения форматов JPEG, JPG или PNG.'});
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
            if (request.query.name && request.product.name !== request.query.name) {
                changes.name = request.query.name;
            }
            if (request.query.description && request.product.description !== request.query.description) {
                changes.description = request.query.description;
            }
            if (fileUrl !== process.env.DEFAULT_SHOP_ICON) {
                changes.icon = fileUrl;
            }
            if (request.query.price && request.product.price !== request.query.price) {
                changes.price = request.query.price;
                if (Object.keys(changes).length <= 2 && request.product.verify_status === 1) {
                    changes.verify_status = 1
                }
            }
            await Product.update(changes, {
                where: {
                    id: request.product.id
                }
            });

            delete changes.verify_status;

            await ProductHistory.create({
                action_type: "edited",
                userId: user.id,
                productId: request.product.id,
                data: changes,
            })

            if (changes.verify_status === 0) {
                await ProductHistory.create({
                    action_type: "recheck",
                    userId: user.id,
                    productId: request.product.id,
                })
                return reply.status(200).send({
                    message: 'Товар успешно отправлен на проверку!'
                });
            }

            return reply.status(200).send({
                message: 'Цена товара изменена без проверок!'
            });
        } catch (err) {
            console.error(err);
            return reply.status(500).send({message: 'Ошибка при создании магазина.'});
        }
    });
};
