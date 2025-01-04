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
        fm_worker: {
            type: DataTypes.TINYINT,
            defaultValue: 0
        },
    }, {
        tableName: 'users',
        timestamps: true
    });
}