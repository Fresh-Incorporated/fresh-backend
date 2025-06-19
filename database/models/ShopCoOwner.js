const { DataTypes, QueryTypes} = require('sequelize');

module.exports = async function (fastify, options) {
    const sequelize = fastify.sequelize;

    return sequelize.define('ShopCoOwner', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        status: {
            type: DataTypes.ENUM("pending", "accepted", "declined"),
            allowNull: false,
        },
        edit_shop_info: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        create_products: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        edit_products: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        refill_products: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        delete_products: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
    }, {
        tableName: 'shop_co_owners',
        paranoid: true,
        updatedAt: false
    });
}