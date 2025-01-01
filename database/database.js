async function setupDatabase(fastify) {
    const UserModel = await require('./models/User')(fastify);

    fastify.sequelize.sync({force: false})
        .then(async () => {
            console.log("Database synchronized successfully")
        })
        .catch(err => console.error("Error synchronizing database:", err));
}

module.exports = { setupDatabase }