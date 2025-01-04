async function setupDatabase(fastify) {
    const UserModel = await require('./models/User')(fastify);
    const ShopModel = await require('./models/Shop')(fastify);
    const ProductModel = await require('./models/Product')(fastify);

    UserModel.hasMany(ShopModel, {foreignKey: 'ownerId'});
    ShopModel.belongsTo(UserModel, {foreignKey: 'ownerId', as: 'owner'});

    ShopModel.hasMany(ProductModel, {foreignKey: 'shopId', as: 'products'});
    ProductModel.belongsTo(ShopModel, {foreignKey: 'shopId', as: 'shop'});

    fastify.sequelize.sync({force: false})
        .then(async () => {
            console.log("Database synchronized successfully")
        })
        .catch(err => console.error("Error synchronizing database:", err));
}

module.exports = { setupDatabase }