const { Op } = require('sequelize');

async function refreshDiscordSellers(client) {
    const { User, Shop, ShopCoOwner } = client.fastify.sequelize.models;
    const guild = client.guild;
    const sellerRoleId = process.env.DISCORD_ROLE_SELLER;

    // Получаем всех пользователей с discordId
    const users = await User.findAll({
        where: {
            discordId: { [Op.ne]: null }
        },
        attributes: ['id', 'discordId'],
        raw: true
    });

    const userMap = new Map(users.map(user => [user.id, user.discordId]));

    // Собираем всех владельцев магазинов
    const shopOwners = await Shop.findAll({
        attributes: ['ownerId'],
        where: { enabled: true },
        raw: true
    });

    const ownerIds = shopOwners.map(shop => shop.ownerId);

    // Собираем всех принятых совладельцев магазинов
    const shopCoOwners = await ShopCoOwner.findAll({
        attributes: ['userId'],
        where: {
            status: 'accepted'
        },
        raw: true
    });

    const coOwnerIds = shopCoOwners.map(co => co.userId);

    // Объединяем владельцев и совладельцев
    const sellerIdsSet = new Set([...ownerIds, ...coOwnerIds]);
    const sellerDiscordIds = Array.from(sellerIdsSet)
        .map(id => userMap.get(id))
        .filter(Boolean);

    // Все discordId из User
    const allDiscordIds = Array.from(userMap.values());

    // Обрабатываем каждого пользователя
    for (const discordId of allDiscordIds) {
        try {
            const member = await guild.members.fetch(discordId);
            const hasRole = member.roles.cache.has(sellerRoleId);
            const shouldHave = sellerDiscordIds.includes(discordId);

            if (shouldHave && !hasRole) {
                await member.roles.add(sellerRoleId);
                console.log(`Добавлена роль продавца: ${discordId}`);
            } else if (!shouldHave && hasRole) {
                await member.roles.remove(sellerRoleId);
                console.log(`Удалена роль продавца: ${discordId}`);
            }
        } catch (err) {
            console.warn(`Ошибка при обработке ${discordId}:`, err.message);
        }
    }

    console.log("Обновление ролей продавцов завершено.");
}

module.exports = { refreshDiscordSellers }