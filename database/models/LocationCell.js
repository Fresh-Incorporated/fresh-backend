const { DataTypes, QueryTypes} = require('sequelize');

module.exports = async function (fastify, options) {
    const sequelize = fastify.sequelize;

    return sequelize.define('LocationCell', {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true
        },
        world: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        letter: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        number: {
            type: DataTypes.INTEGER,
            allowNull: false,
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
        slots: {
            type: DataTypes.INTEGER,
            defaultValue: 27,
            allowNull: false,
        }
    }, {
        tableName: 'location_cells',
        timestamps: false
    });
}