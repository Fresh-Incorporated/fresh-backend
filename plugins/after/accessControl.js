const fp = require('fastify-plugin');

/**
 * Access controls
 */
module.exports = fp(async (fastify, opts) => {
    const { User, Shop, ShopCoOwner, Product } = fastify.sequelize.models;

    fastify.decorate('requireAuth', async function (request, reply) {
        const accessToken = request.cookies.access_token;
        if (!accessToken) {
            return reply.status(401).send({ error: 'Missing access token' });
        }

        const decoded = fastify.jwt.verify(accessToken);
        const user = await User.findOne({
            where: { id: decoded.id },
            attributes: { exclude: ['updatedAt'] },
        });

        if (!user) {
            return reply.status(400).send({ message: "Пользователь не найден." });
        }

        request.user = user;
    });

    fastify.decorate('requireShopAccess', async function (request, reply) {
        await fastify.requireAuth(request, reply);

        const shop = await Shop.findOne({
            where: { id: request.params.shop },
            include: [{
                model: ShopCoOwner,
                as: 'co_owners',
                where: {
                    userId: request.user.id,
                    status: 'accepted'
                },
                required: false
            }]
        });

        if (!shop) {
            return reply.status(404).send({ message: 'Магазин не найден' });
        }

        const isOwner = shop.ownerId === request.user.id;
        const coOwnerRecord = shop.co_owners[0] ?? null;

        if (!isOwner && !coOwnerRecord) {
            return reply.status(403).send({ message: 'Недостаточно прав' });
        }

        request.shop = shop;
        request.isOwner = isOwner;
        request.isCoOwner = !!coOwnerRecord;
        request.coOwner = coOwnerRecord;
    });

    fastify.decorateRequest('hasShopPermission', function (permission) {
        if (this.isOwner) return true;
        if (this.coOwner && this.coOwner[permission]) return true;
        return false;
    });

    // Дропает ошибкой запрос если чел совладелец но у него нет права
    // Например: request.assertShopPermission('delete_products')
    fastify.decorateRequest('assertShopPermission', function (permission) {
        if (this.isOwner) return;
        if (this.coOwner && this.coOwner[permission]) return;

        throw fastify.httpErrors.forbidden('Недостаточно прав');
    });

    fastify.decorate('requireProductAccess', async function (request, reply) {
        await fastify.requireShopAccess(request, reply);

        const product = await Product.findOne({
            where: { shopId: request.shop.id, id: request.params.product }
        });

        if (!product) {
            return reply.status(404).send({ message: 'Товар не найден' });
        }

        request.product = product;
    });
});
