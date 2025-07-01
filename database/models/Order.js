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
            type: DataTypes.JSONB,
            allowNull: false,
        },
        price: {
            type: DataTypes.DOUBLE,
            allowNull: false,
        },
        status: { // 0 - Не принят / 1 - Принят логистом / 2 - Пополнен логиста, поиск курьера / 3 - Принят курьером / 4 - Доставлен / 5 - Подтверждён
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
        paranoid: true,
        timestamps: true
    });
}