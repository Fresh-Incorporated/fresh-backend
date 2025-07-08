import 'fastify';
import { Sequelize } from 'sequelize';
import { User } from "../src/models/User";
import { Shop } from "../src/models/Shop";

declare module 'fastify' {
    interface FastifyInstance {
        sequelize: Sequelize;
        requireAuth: (req: FastifyRequest, rep: FastifyReply) => Promise<void>;
        requireShopAccess: (req: FastifyRequest, rep: FastifyReply) => Promise<void>;
        requireProductAccess: (req: FastifyRequest, rep: FastifyReply) => Promise<void>;
    }

    interface FastifyRequest {
        user?: User
        shop?: Shop
        coOwner?: any
        isOwner?: boolean
        isCoOwner?: boolean
        product?: any

        hasShopPermission: (perm: string) => boolean
        assertShopPermission: (perm: string) => void
    }
}
