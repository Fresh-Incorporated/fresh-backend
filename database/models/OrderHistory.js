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
            type: DataTypes.ENUM("created", "paid", "collect_picked", "collect_finished", "deliver_started", "deliver_finished", "confirmed"),
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
        tableName: 'orders_history',
        paranoid: true,
        timestamps: true
    });
}