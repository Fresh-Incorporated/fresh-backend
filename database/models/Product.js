const { DataTypes, QueryTypes} = require('sequelize');

module.exports = async function (fastify, options) {
    const sequelize = fastify.sequelize;

    return sequelize.define('Product', {
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
        stack_count: {
            type: DataTypes.SMALLINT,
            allowNull: false,
        },
        slots_count: {
            type: DataTypes.SMALLINT,
            allowNull: false,
        },
        price: {
            type: DataTypes.DOUBLE,
            allowNull: false,
        },
        verify_status: { // -1 - Не прошёл проверку / 0 - На проверке / 1 - Проверен
            type: DataTypes.SMALLINT,
            defaultValue: 0,
            allowNull: false,
        },
        refill_status: { // 0 - Не пополняется / 1 - Продавец в режиме пополнения / 2 - Ожидает пополнения логистом / 3 - Принято логистом
            type: DataTypes.SMALLINT,
            defaultValue: 0,
            allowNull: false,
        },
        count: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false,
        },
        enabled: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            allowNull: false,
        },
    }, {
        tableName: 'products',
        paranoid: true,
        timestamps: true
    });
}