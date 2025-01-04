const { DataTypes, QueryTypes} = require('sequelize');

module.exports = async function (fastify, options) {
    const sequelize = fastify.sequelize;

    return sequelize.define('VerifyBlank', {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true
        },
        type: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        status: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        text: {
            type: DataTypes.TEXT,
            allowNull: true
        },
    }, {
        tableName: 'verify_blanks',
        timestamps: true
    });
}