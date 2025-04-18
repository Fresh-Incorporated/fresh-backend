const { DataTypes, QueryTypes} = require('sequelize');

module.exports = async function (fastify, options) {
    const sequelize = fastify.sequelize;

    return sequelize.define('ProductHistory', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        action_type: {
            type: DataTypes.ENUM("created", "accepted", "declined", "refill_started", "refill_waiting", "refill_picked", "refill_completed", "recheck", "edited"),
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
        tableName: 'products_history',
        paranoid: true,
        timestamps: true
    });
}