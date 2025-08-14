import {Client, Collection, GatewayIntentBits} from 'discord.js'
import { refreshDiscordSellers } from './common/sellerRoles'
import type { FastifyInstance } from 'fastify'
import CommandsUtil from "./utils/CommandsUtil";

declare module 'discord.js' {
    interface Client {
        fastify?: FastifyInstance
        guild?: Guild
        commands: Collection<any, any>;
    }
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
})

CommandsUtil.loadCommands(client)
CommandsUtil.registerEvents(client)

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

    CommandsUtil.refreshCommands(client)
    await refreshDiscordSellers(client)
})

async function startBot(fastifyInstance: FastifyInstance): Promise<void> {
    client.fastify = fastifyInstance
    fastifyInstance.discordBot = client
    const botSecret = process.env.DISCORD_BOT_SECRET
    if (!botSecret) {
        return fastifyInstance.log.warn("DISCORD_BOT_SECRET env variable is not set! DISCORD BOT SKIPPED")
    }
    await client.login(botSecret)
}

export { startBot }
