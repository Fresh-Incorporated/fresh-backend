const { DataTypes, QueryTypes} = require('sequelize');

module.exports = async function (fastify, options) {
    const sequelize = fastify.sequelize;

    return sequelize.define('LocationImage', {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true
        },
        image: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
    }, {
        tableName: 'location_images',
        timestamps: true
    });
}