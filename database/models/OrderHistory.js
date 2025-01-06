const { DataTypes, QueryTypes} = require('sequelize');

module.exports = async function (fastify, options) {
    const sequelize = fastify.sequelize;

    return sequelize.define('OrderHistory', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        action_type: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        message: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        data: {
            type: DataTypes.JSON,
            allowNull: true,
        },
    }, {
        tableName: 'orders_history',
        timestamps: true
    });
}