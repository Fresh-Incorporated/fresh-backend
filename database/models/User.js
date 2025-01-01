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
            type: DataTypes.STRING,
            allowNull: false,
        },
        discordId: {
            type: DataTypes.BIGINT,
            allowNull: true,
            unique: true
        },
    }, {
        tableName: 'users',
        timestamps: true
    });
}