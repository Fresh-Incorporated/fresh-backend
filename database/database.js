async function setupDatabase(fastify) {
    const UserModel = await require('./models/User')(fastify);
    const ShopModel = await require('./models/Shop')(fastify);
    const ProductModel = await require('./models/Product')(fastify);
    const LocationModel = await require('./models/Location')(fastify);
    const LocationImageModel = await require('./models/LocationImage')(fastify);
    const LocationCoordinateModel = await require('./models/LocationCoordinate')(fastify);
    const LocationCellModel = await require('./models/LocationCell')(fastify);
    const ProductHistoryModel = await require('./models/ProductHistory')(fastify);
    const OrderModel = await require('./models/Order')(fastify);
    const OrderHistoryModel = await require('./models/OrderHistory')(fastify);
    const ShopHistoryModel = await require('./models/ShopHistory')(fastify);

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

    ProductModel.belongsTo(LocationCellModel, {foreignKey: 'refillCellId', as: 'refillCell'});

    ProductModel.belongsTo(UserModel, {foreignKey: 'currentRefillerId', as: 'currentRefiller'});

    OrderModel.belongsTo(UserModel, {foreignKey: 'customerId', as: 'customer'});
    OrderModel.belongsTo(UserModel, {foreignKey: 'currentWorkerId', as: 'currentWorker'});
    OrderModel.belongsTo(LocationModel, {foreignKey: 'branchId', as: 'branch'});
    OrderModel.belongsTo(LocationCellModel, {foreignKey: 'branchCellId', as: 'branchCell'});
    OrderModel.belongsTo(LocationCellModel, {foreignKey: 'deliverCellId', as: 'deliverCell'});

    OrderHistoryModel.belongsTo(UserModel, {foreignKey: 'userId', as: 'user'});
    OrderHistoryModel.belongsTo(OrderModel, {foreignKey: 'orderId', as: 'order'});
    OrderModel.hasMany(OrderHistoryModel, {foreignKey: 'orderId', as: 'history'});

    ShopModel.hasMany(ShopHistoryModel, {foreignKey: 'shopId', as: 'history'});
    ShopHistoryModel.belongsTo(ShopModel, {foreignKey: 'shopId', as: 'history'});

    fastify.sequelize.sync({force: false})
        .then(async () => {
            console.log("Database synchronized successfully")
        })
        .catch(err => console.error("Error synchronizing database:", err));
}

module.exports = { setupDatabase }