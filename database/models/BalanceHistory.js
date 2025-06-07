const { DataTypes, QueryTypes} = require('sequelize');

module.exports = async function (fastify, options) {
    const sequelize = fastify.sequelize;

    return sequelize.define('BalanceHistory', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        value: {
            type: DataTypes.DOUBLE,
            allowNull: false,
        },
        message: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        action_type: {
            type: DataTypes.ENUM("deposit", "freshmarket_shop_withdraw", "withdraw", "freshmarket_order", "freshmarket_pay", "freshmarket_salary"),
            allowNull: true,
        },
    }, {
        tableName: 'balance_history',
        paranoid: true,
        timestamps: true
    });
}