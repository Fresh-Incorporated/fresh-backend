async function setupDatabase(fastify) {
    const UserModel = await require('./models/User')(fastify);
    const ShopModel = await require('./models/Shop')(fastify);
    const ProductModel = await require('./models/Product')(fastify);
    const VerifyModel = await require('./models/VerifyBlank')(fastify);

    UserModel.hasMany(ShopModel, {foreignKey: 'ownerId'});
    ShopModel.belongsTo(UserModel, {foreignKey: 'ownerId', as: 'owner'});

    ShopModel.hasMany(ProductModel, {foreignKey: 'shopId', as: 'products'});
    ProductModel.belongsTo(ShopModel, {foreignKey: 'shopId', as: 'shop'});

    ShopModel.belongsTo(VerifyModel, {foreignKey: 'verifyId', as: 'verify_blank'});
    VerifyModel.hasOne(ShopModel, {foreignKey: 'verifyId', as: 'shop'})

    ProductModel.belongsTo(VerifyModel, {foreignKey: 'verifyId', as: 'verify_blank'});
    VerifyModel.hasOne(ProductModel, {foreignKey: 'verifyId', as: 'product'})

    fastify.sequelize.sync({force: false})
        .then(async () => {
            console.log("Database synchronized successfully")
        })
        .catch(err => console.error("Error synchronizing database:", err));
}

module.exports = { setupDatabase }