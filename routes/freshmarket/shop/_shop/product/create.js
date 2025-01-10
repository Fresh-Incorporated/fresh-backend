'use strict'

const { uploadToS3 } = require("../../../../../utils/s3Util");
const {Sequelize, Op} = require("sequelize");
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
        const Product = fastify.sequelize.model('Product');
        const Location = fastify.sequelize.model('Location');
        const LocationCell = fastify.sequelize.model('LocationCell');
        const ProductHistory = fastify.sequelize.model('ProductHistory');

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

        // Подбор ячейки
        const cell = await LocationCell.findOne({
            where: {
                slots: { [Op.gt]: request.query.slots_count },
                id: {
                    [Op.notIn]: Sequelize.literal(
                        `(SELECT DISTINCT "cellId" FROM "products" WHERE "cellId" IS NOT NULL)`
                    ),
                },
            },
            include: [
                {
                    model: Location,
                    as: "location",
                    where: {
                        type: "storage",
                        enabled: true
                    }
                }
            ],
        });

        let fileUrl = request.query?.minecraft_icon ? `https://img.zaralx.ru/v1/minecraft/${request.query?.minecraft_icon}` : process.env.DEFAULT_SHOP_ICON; // Путь по умолчанию

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
                fileUrl = await uploadToS3(file, process.env.S3_BUCKET_NAME, 'fresh/market/product_icon', true);
            }
        } catch (err) {
            console.warn('Файл не был загружен, используется иконка по умолчанию.');
        }

        try {
            const newProduct = await Product.create({
                shopId: shop.id,
                name: request.query.name,
                description: request.query.description,
                stack_count: request.query.stack_count,
                slots_count: request.query.slots_count,
                price: request.query.price,
                icon: fileUrl,
                cellId: cell?.id
            });

            await ProductHistory.create({
                action_type: "created",
                userId: user.id, // Тот кто создал товар
                productId: newProduct.id,
                data: {
                    name: newProduct.name,
                    description: newProduct.description,
                    stack_count: newProduct.stack_count,
                    slots_count: newProduct.slots_count,
                    price: newProduct.price,
                    icon: newProduct.icon,
                },
            })

            return reply.status(200).send({
                message: 'Товар успешно создан.',
                product: newProduct,
            });
        } catch (err) {
            console.error(err);
            return reply.status(500).send({ message: 'Ошибка при создании магазина.' });
        }
    });
};
