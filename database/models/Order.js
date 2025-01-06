const { DataTypes, QueryTypes} = require('sequelize');

module.exports = async function (fastify, options) {
    const sequelize = fastify.sequelize;

    return sequelize.define('Order', {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true
        },
        type: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        world: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        x: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        y: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        z: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        data: {
            type: DataTypes.JSON,
            allowNull: false,
        },
        price: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        status: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false,
        },
        paid: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false,
        },
    }, {
        tableName: 'orders',
        timestamps: true
    });
}