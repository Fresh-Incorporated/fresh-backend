import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    User as DiscordUser
} from "discord.js";
import { User } from "../../../models/User";
import { Shop } from "../../../models/Shop";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("profile")
        .setDescription("Отобразить профиль пользователя")
        .addUserOption(option =>
            option
                .setName("пользователь")
                .setDescription("Укажите пользователя для просмотра профиля")
                .setRequired(false)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const target: DiscordUser = interaction.options.getUser("пользователь") || interaction.user;

        // Проверка прав
        const executor = await User.findOne({ where: { discordId: interaction.user.id } });

        if (!executor) {
            return interaction.reply({
                content: "❌ Вы не зарегистрированы на сайте.",
                ephemeral: true
            });
        }

        if (target.id !== interaction.user.id && !executor.admin) {
            return interaction.reply({
                content: "❌ У вас нет прав для просмотра чужого профиля.",
                ephemeral: true
            });
        }

        const user = await User.findOne({
            where: { discordId: target.id },
            include: [{ model: Shop }]
        });

        if (!user) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xff4d4d)
                        .setTitle("❌ Профиль не найден")
                        .setDescription(
                            target.id === interaction.user.id
                                ? "Вы не зарегистрированы на сайте."
                                : `${target.tag} не зарегистрирован на сайте.`
                        )
                        .setTimestamp()
                ],
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setColor(0x00bfff)
            .setAuthor({
                name: target.tag,
                iconURL: target.displayAvatarURL()
            })
            .setTitle("Профиль пользователя")
            .addFields(
                { name: "ID", value: `${user.id}`, inline: true },
                { name: "Ник", value: `\`${user.nickname}\``, inline: true },
                { name: "Баланс", value: `${user.balance.toFixed(2)} АР`, inline: true },
                {
                    name: "Дата регистрации",
                    value: user.createdAt.toLocaleString("ru-RU"),
                    inline: true
                },
                {
                    name: "Роль FreshMarket",
                    value:
                        user.fm_worker == 4 ? "Директор" :
                            user.fm_worker == 3 ? "Секретарь" :
                                user.fm_worker == 2 ? "Логист" :
                                    user.fm_worker == 1 ? "Курьер" : "Пользователь",
                    inline: true
                },
                {
                    name: "Магазины",
                    value:
                        user.shops.length > 0
                            ? user.shops.map(shop => `${shop.id} | ${shop.name}`).join("\n")
                            : "Нет магазинов",
                    inline: false
                }
            )
            .setFooter({
                text: `${user.uuid}`,
                iconURL: `https://assets.zaralx.ru/api/v1/minecraft/vanilla/player/face/${user.uuid}/full`
            });

        await interaction.reply({
            embeds: [embed],
            ephemeral: true
        });
    }
};
