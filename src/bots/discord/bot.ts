import { Client, GatewayIntentBits } from 'discord.js'
import { refreshDiscordSellers } from './common/sellerRoles'
import type { FastifyInstance } from 'fastify'  // <-- Импорт только типов

declare module 'discord.js' {
    interface Client {
        fastify?: FastifyInstance
        guild?: Guild
    }
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
})

client.on('ready', async () => {
    if (!client.user) return
    console.log(`Logged in as ${client.user.tag}!`)

    if (!client.fastify) {
        throw new Error('Fastify instance is not set on client')
    }

    const guildId = process.env.DISCORD_GUILD
    if (!guildId) {
        throw new Error('DISCORD_GUILD env variable is not set')
    }

    const guild = await client.guilds.fetch(guildId)
    client.guild = guild

    await refreshDiscordSellers(client)
})

async function startBot(fastifyInstance: FastifyInstance): Promise<void> {
    client.fastify = fastifyInstance
    const botSecret = process.env.DISCORD_BOT_SECRET
    if (!botSecret) {
        throw new Error('DISCORD_BOT_SECRET env variable is not set')
    }
    await client.login(botSecret)
}

export { startBot }
