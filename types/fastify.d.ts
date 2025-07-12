import 'fastify';
import { Sequelize } from 'sequelize';
import { User } from "../src/models/User";
import { Shop } from "../src/models/Shop";
import {Product} from "../src/models/Product";
import {ShopCoOwner} from "../src/models/ShopCoOwner";
import {Client} from "discord.js";

declare module 'fastify' {
    interface FastifyInstance {
        sequelize: Sequelize;
        discordBot: Client;
        requireAuth: (req: FastifyRequest, rep: FastifyReply) => Promise<void>;
        requireShopAccess: (req: FastifyRequest, rep: FastifyReply) => Promise<void>;
        requireProductAccess: (req: FastifyRequest, rep: FastifyReply) => Promise<void>;
    }

    interface FastifyRequest {
        user: User
        shop: Shop
        product: Product
        coOwner?: ShopCoOwner
        isOwner?: boolean
        isCoOwner?: boolean

        hasShopPermission: (perm: string) => boolean
        assertShopPermission: (perm: string) => void
    }
}
