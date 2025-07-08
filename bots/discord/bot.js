const { Client, GatewayIntentBits, Collection } = require('discord.js');
const {refreshDiscordSellers} = require("./common/sellerRoles");

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    client.fastify.discord_bot = client

    const guild = await client.guilds.fetch(process.env.DISCORD_BOT_GUILD);
    client.guild = guild;

    await refreshDiscordSellers(client)
});

async function startBot(f) {
    client.fastify = f;
    await client.login(process.env.DISCORD_BOT_SECRET);
}

module.exports = { startBot };
