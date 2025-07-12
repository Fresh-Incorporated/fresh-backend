import { Op } from 'sequelize'
import type { Client, Guild, GuildMember } from 'discord.js'
import {User} from "../../../models/User";
import {Shop} from "../../../models/Shop";
import {ShopCoOwner} from "../../../models/ShopCoOwner";

async function refreshDiscordSellers(client: Client & { fastify?: any; guild?: Guild }): Promise<void> {
    const guild = client.guild
    if (!guild) throw new Error('Guild is not set on client')

    const sellerRoleId = process.env.DISCORD_ROLE_SELLER as string
    if (!sellerRoleId) throw new Error('DISCORD_ROLE_SELLER env variable is not set')

    // Получаем всех пользователей с discordId
    const users: User[] = await User.findAll({
        where: {
            discordId: { [Op.ne]: null }
        },
        attributes: ['id', 'discordId'],
        raw: true
    })

    const userMap = new Map(users.map(user => [user.id, user.discordId!]))

    // Собираем всех владельцев магазинов
    const shopOwners: Shop[] = await Shop.findAll({
        attributes: ['ownerId'],
        where: { enabled: true },
        raw: true
    })

    const ownerIds = shopOwners.map(shop => shop.ownerId)

    // Собираем всех принятых совладельцев магазинов
    const shopCoOwners: ShopCoOwner[] = await ShopCoOwner.findAll({
        attributes: ['userId'],
        where: {
            status: 'accepted'
        },
        raw: true
    })

    const coOwnerIds = shopCoOwners.map(co => co.userId)

    // Объединяем владельцев и совладельцев
    const sellerIdsSet = new Set([...ownerIds, ...coOwnerIds])
    const sellerDiscordIds = Array.from(sellerIdsSet)
        .map(id => userMap.get(id))
        .filter((id): id is string => Boolean(id))

    // Все discordId из User
    const allDiscordIds = Array.from(userMap.values())

    // Обрабатываем каждого пользователя
    for (const discordId of allDiscordIds) {
        try {
            const member: GuildMember = await guild.members.fetch(discordId)
            const hasRole = member.roles.cache.has(sellerRoleId)
            const shouldHave = sellerDiscordIds.includes(discordId)

            if (shouldHave && !hasRole) {
                await member.roles.add(sellerRoleId)
                console.log(`Добавлена роль продавца: ${discordId}`)
            } else if (!shouldHave && hasRole) {
                await member.roles.remove(sellerRoleId)
                console.log(`Удалена роль продавца: ${discordId}`)
            }
        } catch (err: any) {
            console.warn(`Ошибка при обработке ${discordId}:`, err.message)
        }
    }

    console.log('Обновление ролей продавцов завершено.')
}

export { refreshDiscordSellers }