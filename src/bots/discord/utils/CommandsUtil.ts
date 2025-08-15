import path from "path";
import fs from "fs";
import {Client, Collection, Events, MessageFlags, REST, Routes} from "discord.js";

export default class CommandsUtil {
    static loadCommands(client: Client) {
        client.commands = new Collection();

        const foldersPath = path.join(__dirname, '../commands');
        const entries = fs.readdirSync(foldersPath, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const commandsPath = path.join(foldersPath, entry.name);
                const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
                for (const file of commandFiles) {
                    this.loadCommandFile(client, path.join(commandsPath, file));
                }
            } else if (entry.isFile() && entry.name.endsWith('.js')) {
                this.loadCommandFile(client, path.join(foldersPath, entry.name));
            }
        }
    }

    private static loadCommandFile(client: Client, filePath: string) {
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.warn(`[WARNING] The command at ${filePath} is missing "data" or "execute".`);
        }
    }

    static registerEvents(client: Client) {
        client.on(Events.InteractionCreate, async interaction => {
            if (!interaction.isChatInputCommand()) return;

            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
                } else {
                    await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
                }
            }
        });
    }

    static refreshCommands(client: Client) {
        const rest = new REST().setToken(process.env.DISCORD_BOT_SECRET as string);

        (async () => {
            try {
                // The put method is used to fully refresh all commands in the guild with the current set

                console.log(client.commands)
                const data: any = await rest.put(
                    Routes.applicationGuildCommands(client.user?.id as string, client.guild?.id as string),
                    { body: Array.from(client.commands.values()).map(cmd => cmd.data.toJSON()) },
                );

                console.log(`Successfully reloaded ${data.length} application (/) commands.`);
            } catch (error) {
                // And of course, make sure you catch and log any errors!
                console.error(error);
            }
        })();
    }
}