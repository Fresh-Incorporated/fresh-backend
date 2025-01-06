async function setupDatabase(fastify) {
    const UserModel = await require('./models/User')(fastify);
    const ShopModel = await require('./models/Shop')(fastify);
    const ProductModel = await require('./models/Product')(fastify);
    const LocationModel = await require('./models/Location')(fastify);
    const LocationImageModel = await require('./models/LocationImage')(fastify);
    const LocationCoordinateModel = await require('./models/LocationCoordinate')(fastify);
    const LocationCellModel = await require('./models/LocationCell')(fastify);
    const ProductHistoryModel = await require('./models/ProductHistory')(fastify);

    UserModel.hasMany(ShopModel, {foreignKey: 'ownerId'});
    ShopModel.belongsTo(UserModel, {foreignKey: 'ownerId', as: 'owner'});

    ShopModel.hasMany(ProductModel, {foreignKey: 'shopId', as: 'products'});
    ProductModel.belongsTo(ShopModel, {foreignKey: 'shopId', as: 'shop'});

    LocationModel.hasMany(LocationImageModel, {foreignKey: 'locationId', as: 'images'});
    LocationImageModel.belongsTo(LocationModel, {foreignKey: 'locationId', as: 'location'});

    LocationModel.hasMany(LocationCoordinateModel, {foreignKey: 'locationId', as: 'coordinates'});
    LocationCoordinateModel.belongsTo(LocationModel, {foreignKey: 'locationId', as: 'location'});

    ProductModel.belongsTo(LocationCellModel, {foreignKey: 'cellId', as: 'cell'});

    LocationModel.hasMany(LocationCellModel, {foreignKey: 'locationId', as: 'cells'});
    LocationCellModel.belongsTo(LocationModel, {foreignKey: 'locationId', as: 'location'});

    ProductHistoryModel.belongsTo(UserModel, {foreignKey: 'userId', as: 'user'});
    ProductHistoryModel.belongsTo(ProductModel, {foreignKey: 'productId', as: 'product'});
    ProductModel.hasMany(ProductHistoryModel, {foreignKey: 'productId', as: 'history'});

    fastify.sequelize.sync({force: false})
        .then(async () => {
            console.log("Database synchronized successfully")
        })
        .catch(err => console.error("Error synchronizing database:", err));
}

module.exports = { setupDatabase }