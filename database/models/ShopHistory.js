const { DataTypes, QueryTypes} = require('sequelize');

module.exports = async function (fastify, options) {
    const sequelize = fastify.sequelize;

    return sequelize.define('ShopHistory', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        action_type: {
            type: DataTypes.ENUM("created", "ordered", "withdraw"),
            allowNull: false,
        },
        message: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        data: {
            type: DataTypes.JSONB,
            allowNull: true,
        },
    }, {
        tableName: 'shops_history',
        paranoid: true,
        timestamps: true
    });
}