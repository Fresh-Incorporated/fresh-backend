'use strict'

const fp = require('fastify-plugin');
const { Sequelize } = require('sequelize');

async function dbConnector(fastify, options) {
    const sequelize = new Sequelize(
        process.env.DATABASE_NAME,
        process.env.DATABASE_USERNAME,
        process.env.DATABASE_PASSWORD,
        {
            host: process.env.DATABASE_HOST,
            port: process.env.DATABASE_PORT,
            dialect: 'postgres',
            logging: true
        }
    );

    try {
        await sequelize.authenticate();
        console.log('Connection to the database has been established successfully.');

        fastify.decorate('sequelize', sequelize);
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
}

module.exports = fp(dbConnector);