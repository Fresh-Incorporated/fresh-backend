'use strict'

const {uploadToS3} = require("../../../../utils/s3Util");
module.exports = async function (fastify, opts) {
    fastify.addHook('onRequest', async (request, reply) => {
        const User = fastify.sequelize.model('User');
        try {
            const accessToken = request.cookies.access_token;
            if (!accessToken) {
                return reply.status(401).send({error: 'Missing access token'});
            }

            request.user = fastify.jwt.verify(accessToken);

            request.user = await User.findOne({
                where: {
                    id: request.user.id
                },
                attributes: {exclude: ['updatedAt']},
            });

            if (!request.user) {
                return reply.status(400).send({
                    message: "Пользователь не найден."
                });
            }

            if (request.user.fm_worker < 4) {
                return reply.status(403).send({
                    message: "Недостаточно прав."
                });
            }
        } catch (err) {
            reply.status(401).send({error: 'Unauthorized'});
        }
    });

    fastify.get('/locations', async function (request, reply) {
        const Location = fastify.sequelize.model('Location');
        const LocationImage = fastify.sequelize.model('LocationImage');
        const LocationCoordinate = fastify.sequelize.model('LocationCoordinate');
        const LocationCell = fastify.sequelize.model('LocationCell');

        const locations = await Location.findAll({
            include: [
                {
                    model: LocationCoordinate,
                    as: "coordinates"
                },
                {
                    model: LocationImage,
                    as: "images"
                },
                {
                    model: LocationCell,
                    as: "cells"
                }
            ]
        })

        return reply.status(200).send(locations);
    });

    fastify.post('/location/create', async function (request, reply) {
        const Location = fastify.sequelize.model('Location');
        const LocationImage = fastify.sequelize.model('LocationImage');
        const LocationCoordinate = fastify.sequelize.model('LocationCoordinate');

        const formData = await request.formData()

        const name = formData.get("name")
        const description = formData.get("description")
        const type = formData.get("type")
        const city = formData.get("city")
        const coordinates = JSON.parse(formData.get("coordinates"))

        if (!["storage", "refill"].includes(type)) {
            return reply.status(400).send({message: "Не подходящий тип локации."})
        }

        const images = [];
        for (const key in request.body) {
            const field = request.body[key];

            // Проверяем, является ли поле файлом
            if (field.file) {
                // Проверка на тип файла
                const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg'];
                if (!allowedMimeTypes.includes(field.mimetype)) {
                    return reply.status(400).send({message: 'Допускаются только изображения форматов JPEG, JPG или PNG.'});
                }

                const buffer = await field.toBuffer();
                images.push({
                    filename: field.filename,
                    mimetype: field.mimetype,
                    size: buffer.length,
                    buffer: buffer,
                });
            }
        }

        const imageUrls = []

        // Загрузка на s3
        for (const image of images) {
            const fileUrl = await uploadToS3(image, process.env.S3_BUCKET_NAME, 'fresh/market/location_image', true)
            imageUrls.push(fileUrl);
        }

        // Создание локации
        const location = await Location.create({
            name,
            description,
            type,
            city,
        })

        // Создание координат локации
        for (const coordinate of coordinates) {
            if (coordinate?.x == null ||
                coordinate?.y == null ||
                coordinate?.z == null ||
                coordinate?.world == null
            ) continue;

            const _coordinate = await LocationCoordinate.create({
                x: coordinate.x,
                y: coordinate.y,
                z: coordinate.z,
                world: coordinate.world,
                locationId: location.id,
            })
        }

        // Добавление изображений локации
        for (const url of imageUrls) {
            const locationImage = await LocationImage.create({
                image: url,
                locationId: location.id
            })
        }

        return reply.status(200).send({
            message: "Локация успешно создана"
        });
    });

    fastify.post('/location/:location/cells/add', async function (request, reply) {
        const Location = fastify.sequelize.model('Location');
        const LocationImage = fastify.sequelize.model('LocationImage');
        const LocationCoordinate = fastify.sequelize.model('LocationCoordinate');
        const LocationCell = fastify.sequelize.model('LocationCell');

        const location = await Location.findOne({
            where: {
                id: request.params.location
            },
            attributes: {exclude: ['updatedAt']},
        });

        if (!location) {
            return reply.status(400).send({message: "Локация не найдена"})
        }

        const cellsToInsert = request.body.cells.map(cell => ({
            letter: cell.letter,
            number: cell.number,
            locationId: location.id
        }));

        await LocationCell.bulkCreate(cellsToInsert);

        return reply.status(200).send({ message: "Ячейки добавлены" });
    });

    fastify.post('/location/:location/enable', async function (request, reply) {
        const Location = fastify.sequelize.model('Location');
        const LocationCell = fastify.sequelize.model('LocationCell');

        const location = await Location.findOne({
            where: {
                id: request.params.location
            },
            include: [
                {
                    model: LocationCell,
                    as: "cells"
                }
            ],
            attributes: {exclude: ['updatedAt']},
        });

        if (!location) {
            return reply.status(400).send({message: "Локация не найдена"})
        }

        if (location.cells.length === 0) {
            return reply.status(400).send({ message: "Невозможно включить локацию с 0 ячеек"})
        }

        await location.update({enabled: true});

        return reply.status(200).send({ message: "Локация включена" });
    });

    fastify.post('/location/:location/disable', async function (request, reply) {
        const Location = fastify.sequelize.model('Location');
        const LocationCell = fastify.sequelize.model('LocationCell');

        const location = await Location.findOne({
            where: {
                id: request.params.location
            },
            attributes: {exclude: ['updatedAt']},
        });

        if (!location) {
            return reply.status(400).send({message: "Локация не найдена"})
        }

        await location.update({enabled: false});

        return reply.status(200).send({ message: "Локация выключена" });
    });
};
