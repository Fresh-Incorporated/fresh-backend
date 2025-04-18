const { DataTypes, QueryTypes} = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = async function (fastify, options) {
    const sequelize = fastify.sequelize;

    return sequelize.define('Shop', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        icon: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        products_limit: {
            type: DataTypes.SMALLINT,
            allowNull: false,
            defaultValue: 3,
        },
        verify_status: { // -1 - Не прошёл проверку / 0 - На проверке / 1 - Проверен
            type: DataTypes.SMALLINT,
            defaultValue: 0,
            allowNull: false,
        },
        balance: {
            type: DataTypes.DOUBLE,
            allowNull: false,
            defaultValue: 0,
        },
        tag: {
            type: DataTypes.STRING,
            defaultValue: () => uuidv4().replace(/-/g, ''),
            allowNull: false,
            unique: true
        },
        enabled: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            allowNull: false,
        },
    }, {
        tableName: 'shops',
        paranoid: true,
        timestamps: true
    });
}