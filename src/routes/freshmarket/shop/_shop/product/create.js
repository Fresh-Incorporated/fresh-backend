'use strict'

const {uploadToS3} = require("../../../../../utils/s3Util");
const {Sequelize, Op} = require("sequelize");
const {notifyWorkers} = require("../../../../../utils/notifyUtil");
module.exports = async function (fastify, opts) {
    fastify.post('/create', { preHandler: fastify.requireShopAccess }, async function (request, reply) {
        request.assertShopPermission('create_products')

        const User = fastify.sequelize.model('User');
        const Shop = fastify.sequelize.model('Shop');
        const Product = fastify.sequelize.model('Product');
        const Location = fastify.sequelize.model('Location');
        const LocationCell = fastify.sequelize.model('LocationCell');
        const ProductHistory = fastify.sequelize.model('ProductHistory');
        const Tag = fastify.sequelize.model('Tag');

        if (request.query.name.length < 3 || request.query.name.length > 24) {
            return reply.status(400).send({
                message: "Длинна названия должна быть в пределах 3-24 символов."
            });
        }

        if (request.query.description?.length > 240) {
            return reply.status(400).send({
                message: "Длинна описания должна быть не более 240 символов."
            });
        }

        if (parseInt(request.query.stack_count) < 1 || parseInt(request.query.stack_count) > 64) {
            return reply.status(400).send({
                message: "Кол-во предметов в 1 слоте должно быть в пределах 1-64."
            });
        }

        if (parseInt(request.query.slots_count) < 1 || parseInt(request.query.slots_count) > 27) {
            return reply.status(400).send({
                message: "Кол-во слотов еденицы товара должно быть в пределах 1-27."
            });
        }

        if (parseFloat(request.query.price).toFixed(2) < 0.01 || parseFloat(request.query.price).toFixed(2) > 1728) {
            return reply.status(400).send({
                message: "Цена товара должна быть в пределах 0.01-1728."
            });
        }

        let tags = []

        if (request.query.tags && request.query.tags.split("_").length > 3) {
            return reply.status(400).send({
                message: "Количество тегов должно быть не более 3х."
            });
        } else {
            tags = await Tag.findAll({
                where: {
                    id: request.query.tags.split("_")
                }
            });
            if (tags.length !== request.query.tags.split("_").length) {
                return reply.status(400).send({
                    message: "Некоторые теги не найдены. (Ты че, хакер?)"
                });
            }
        }

        const products_count = await Product.count({ where: {shopId: request.shop.id }});

        if (products_count >= request.shop.products_limit) {
            return reply.status(402).send({message: "Создан максимум товаров."});
        }

        // Подбор ячейки
        const cell = await LocationCell.findOne({
            where: {
                slots: {[Op.gt]: request.query.slots_count},
                id: {
                    [Op.notIn]: Sequelize.literal(
                        `(SELECT DISTINCT "cellId" FROM "products" WHERE "cellId" IS NOT NULL AND "deletedAt" IS NULL)`
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
            attributes: ['id']
        });

        let fileUrl = request.query?.minecraft_icon ? `https://assets.zaralx.ru/api/v1/minecraft/vanilla/item/${request.query?.minecraft_icon}/icon` : process.env.DEFAULT_SHOP_ICON; // Путь по умолчанию

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
                return reply.status(400).send({message: 'Иконка должна быть не более 2 МБ!'})
            }
            if (file) {
                const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];
                if (!allowedMimeTypes.includes(file.mimetype)) {
                    return reply.status(400).send({message: 'Допускаются только изображения форматов JPEG, JPG, PNG, SVG или WEBP.'});
                }
                // Загрузка файла в S3
                fileUrl = await uploadToS3(file, process.env.S3_BUCKET_NAME, 'fresh/market/product_icon', true);
            }
        } catch (err) {
            console.warn('Файл не был загружен, используется иконка по умолчанию.');
        }

        try {
            const newProduct = await Product.create({
                shopId: request.shop.id,
                name: request.query.name,
                description: request.query.description,
                stack_count: request.query.stack_count,
                slots_count: request.query.slots_count,
                price: parseFloat(request.query.price).toFixed(2),
                icon: fileUrl,
                cellId: cell?.id
            });

            if (tags.length > 0) {
                await newProduct.addTags(tags.map(tag => tag.id));
            }

            await ProductHistory.create({
                action_type: "created",
                userId: request.user.id, // Тот кто создал товар
                productId: newProduct.id,
                data: {
                    name: newProduct.name,
                    description: newProduct.description,
                    stack_count: newProduct.stack_count,
                    slots_count: newProduct.slots_count,
                    price: newProduct.price,
                    icon: newProduct.icon,
                    tags: tags.map(tag => tag.name)
                },
            })

            notifyWorkers(fastify, 3, "fm_secretary_product", "Новая проверка", "Проверьте товар", "/cabinet/freshmarket/work/secretary/verify/products")

            return reply.status(200).send({
                message: 'Товар успешно создан.',
                product: newProduct,
            });
        } catch (err) {
            console.error(err);
            return reply.status(500).send({message: 'Ошибка при создании магазина.'});
        }
    });
};
