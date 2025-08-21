import {FastifyPluginAsync} from 'fastify'
import {PWClan} from "../../../models/PWClan";
import {CreationAttributes} from "sequelize";

const route: FastifyPluginAsync = async function (fastify, opts) {
    fastify.post<{ Body: { name: string, description: string, tag: string } }>('/create', { preHandler: fastify.requireAuth }, async function (request, reply) {
        const {name, description, tag} = request.body;

        if (request.user?.pwClanId) {
            return reply.status(403).send({ message: "Вы в клане! Покиньте его перед созданием" })
        }

        if (name.length < 3 && name.length > 20) {
            return reply.status(400).send({ message: "Название клана должно быть в пределах 3-20 символов" })
        }

        if (description.length < 3 && description.length > 64) {
            return reply.status(400).send({ message: "Описание клана должно быть в пределах 3-64 символов" })
        }

        if (tag.length != 2 && !/^[A-Z]+$/.test(tag)) {
            return reply.status(400).send({ message: "Тег клана должен быть в виде 2х символов A-Z" })
        }

        const transaction = await fastify.sequelize.transaction();

        try {
            const clan = await PWClan.create({
                name: fastify.badWords.clean(name),
                description: fastify.badWords.clean(description),
                tag: tag,
                ownerId: request.user.id
            } as CreationAttributes<PWClan>, { transaction })

            await request.user.update({ pwClanId: clan.id }, { transaction })

            await transaction.commit()
            reply.status(200).send({ clan })
        } catch (e) {
            await transaction.rollback()
        }
    });
};

export default route;
