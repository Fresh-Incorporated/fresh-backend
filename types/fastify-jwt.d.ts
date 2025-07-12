import { User } from "../src/models/User";

declare module '@fastify/jwt' {
    interface FastifyJWT {
        payload: {
            id: number;
            discordId: number;
        };
        user: User; // FastifyJWT какого то хуя ставит свою хуйню, я это захуярил так.
    }
}
