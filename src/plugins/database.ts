import fp from 'fastify-plugin';
import { Sequelize } from 'sequelize-typescript';
import { FastifyInstance } from 'fastify';
import path from "path";

export default fp(async function (fastify: FastifyInstance) {
    const sequelize = new Sequelize({
        dialect: 'postgres',
        host: process.env.DATABASE_HOST,
        port: parseInt(process.env.DATABASE_PORT || '5432'),
        username: process.env.DATABASE_USERNAME,
        password: process.env.DATABASE_PASSWORD,
        database: process.env.DATABASE_NAME,
        models: [path.join(__dirname, '../models')],
        logging: false,
    });

    try {
        await sequelize.authenticate();
        fastify.log.info('Connected to DB')

        fastify.log.info('Synchronizing tables...')
        await sequelize.sync({ alter: false, force: false });
        fastify.log.info('Tables sync successfully!')

        fastify.decorate('sequelize', sequelize);
    } catch (err) {
        fastify.log.error(err)
    }
});
