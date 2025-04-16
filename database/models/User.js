const { DataTypes, QueryTypes} = require('sequelize');

module.exports = async function (fastify, options) {
    const sequelize = fastify.sequelize;

    return sequelize.define('User', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        nickname: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        uuid: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        discordId: {
            type: DataTypes.BIGINT,
            allowNull: true,
            unique: true
        },
        balance: {
            type: DataTypes.DOUBLE,
            defaultValue: 0
        },
        bonuses: {
            type: DataTypes.DOUBLE,
            defaultValue: 0
        },
        fm_worker: { // 0 - Обычный чел / 1 - Курьер / 2 - Логист / 3 - Секретарь / 4 - Директор
            type: DataTypes.SMALLINT,
            defaultValue: 0
        },
        admin: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
    }, {
        tableName: 'users',
        timestamps: true
    });
}