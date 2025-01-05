const { DataTypes, QueryTypes} = require('sequelize');

module.exports = async function (fastify, options) {
    const sequelize = fastify.sequelize;

    return sequelize.define('LocationCoordinate', {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true
        },
        world: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        x: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        y: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        z: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
    }, {
        tableName: 'location_coordinates',
        timestamps: true
    });
}