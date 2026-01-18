import fp from 'fastify-plugin'
import {FastifyPluginAsync, FastifyReply, FastifyRequest} from 'fastify'
import {User} from "../../models/User";
import {Shop} from "../../models/Shop";
import {PermissionKey, ShopCoOwner} from "../../models/ShopCoOwner";
import {Product} from "../../models/Product";

const accessControlPlugin: FastifyPluginAsync = async (fastify) => {
    fastify.decorate('requireAuth', async function (request: FastifyRequest, reply: FastifyReply) {
        await request.jwtVerify();

        const payloadUser: any = request.user;
        console.log(payloadUser)
        if (!payloadUser || typeof payloadUser.id === 'undefined' || payloadUser.id === null) {
            return reply.status(401).send({message: 'Invalid token payload.'})
        }

        const user = await User.findOne({
            where: {id: payloadUser.id},
            attributes: {exclude: ['updatedAt']}
        })

        if (!user) {
            return reply.status(400).send({message: 'Пользователь не найден.'})
        }

        request.user = user
    })

    fastify.decorate('requireShopAccess', async function (request, reply) {
        await fastify.requireAuth(request, reply);
    
        const { shop } = request.params as { shop: string };
    
        const shopInstance = await Shop.findOne({
            where: { id: shop },
            include: [
                {
                    model: ShopCoOwner,
                    as: 'co_owners',
                    where: {
                        userId: request.user!.id,
                        status: 'accepted'
                    },
                    required: false
                }
            ]
        }) as Shop & { co_owners?: ShopCoOwner[] };
    
        if (!shopInstance) {
            return reply.status(404).send({ message: 'Магазин не найден' });
        }
    
        const isOwner = shopInstance.ownerId === request.user!.id;
        const coOwnerRecord = shopInstance.co_owners?.[0] ?? null;
    
        if (!isOwner && !coOwnerRecord) {
            return reply.status(403).send({ message: 'Недостаточно прав' });
        }
    
        request.shop = shopInstance;
        request.isOwner = isOwner;
        request.coOwner = coOwnerRecord;
        request.isCoOwner = !!coOwnerRecord;
    });

    fastify.decorateRequest('hasShopPermission', function (permission: string): boolean {
        if (this.isOwner) return true
        if (this.coOwner && this.coOwner[permission as PermissionKey]) return true
        return false
    })

    fastify.decorateRequest('assertShopPermission', function (permission: string): void {
        if (this.isOwner) return
        if (this.coOwner && this.coOwner[permission as PermissionKey]) return

        throw fastify.httpErrors.forbidden('Недостаточно прав')
    })

    fastify.decorate('requireProductAccess', async function (request, reply) {
        await fastify.requireShopAccess(request, reply);

        const { product } = request.params as { product: string };

        const productInstance = await Product.findOne({
            where: {
                shopId: request.shop!.id,
                id: product
            }
        });

        if (!productInstance) {
            return reply.status(404).send({ message: 'Товар не найден' });
        }

        request.product = productInstance;
    });
}

export default fp(accessControlPlugin)
