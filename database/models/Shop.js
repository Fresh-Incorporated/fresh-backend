const { DataTypes, QueryTypes} = require('sequelize');

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
        verify_status: {
            type: DataTypes.SMALLINT,
            defaultValue: 0,
            allowNull: false,
        },
    }, {
        tableName: 'shops',
        paranoid: true,
        timestamps: true
    });
}