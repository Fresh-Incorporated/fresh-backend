'use strict'

const { uploadToS3 } = require("../../../../utils/s3Util");
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

    fastify.post('/product/create', async function (request, reply) {
        const User = fastify.sequelize.model('User');
        const Shop = fastify.sequelize.model('Shop');
        const Product = fastify.sequelize.model('Product');

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

        const shop = await Shop.findOne({where: { id: request.params.shop, ownerId: request.user.id }});

        if (!shop) {
            return reply.status(400).send({
                message: "Магазин не существует или у вас недостаточно прав."
            });
        }

        const products = await Product.findAll({ where: { shopId: shop.id } });

        if (products.length >= shop.products_limit) {
            return reply.status(402).send({ message: "Создан максимум товаров." });
        }

        let fileUrl = process.env.DEFAULT_SHOP_ICON; // Путь по умолчанию

        try {
            // Проверка на наличие загруженного файла
            const file = await request.file({ limits: { fileSize: 2 * 1024 * 1024 } }); // 2 MB
            if (file) {
                const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg'];
                if (!allowedMimeTypes.includes(file.mimetype)) {
                    return reply.status(400).send({ message: 'Допускаются только изображения форматов JPEG, JPG или PNG.' });
                }
                // Загрузка файла в S3
                fileUrl = await uploadToS3(file, process.env.S3_BUCKET_NAME, 'fresh/market/product_icon');
            }
        } catch (err) {
            // Если файл отсутствует, используется иконка по умолчанию
            console.warn('Файл не был загружен, используется иконка по умолчанию.');
        }

        try {
            const newProduct = await Product.create({
                shopId: shop.id,
                name: request.query.name,
                description: request.query.description,
                stack_count: request.query.stack_count,
                price: request.query.price,
                icon: fileUrl,
            });

            return reply.status(200).send({
                message: 'Магазин успешно создан.',
                product: newProduct,
            });
        } catch (err) {
            console.error(err);
            return reply.status(500).send({ message: 'Ошибка при создании магазина.' });
        }
    });
};
