/**
 * Leaderboard Command - View XP leaderboard
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const XPService = require('../../services/xpService');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View the server XP leaderboard')
        .addIntegerOption(option =>
            option.setName('page')
                .setDescription('Page number')
                .setRequired(false)
                .setMinValue(1)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const page = interaction.options.getInteger('page') || 1;
        const perPage = 10;
        const offset = (page - 1) * perPage;

        const leaderboard = XPService.getLeaderboard(interaction.guildId, perPage + offset);
        const pageEntries = leaderboard.slice(offset, offset + perPage);

        if (pageEntries.length === 0) {
            return interaction.editReply({
                content: page === 1 
                    ? '❌ No XP data found. Start chatting to earn XP!' 
                    : '❌ No more entries on this page.',
            });
        }

        // Build leaderboard entries
        const entries = await Promise.all(pageEntries.map(async (entry, index) => {
            let username = 'Unknown User';
            try {
                const user = await interaction.client.users.fetch(entry.discordId);
                username = user.username;
            } catch (e) {
                // User not found
            }

            const position = offset + index + 1;
            const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `\`${position}.\``;
            
            return `${medal} **${username}**\nLevel ${entry.level} • ${entry.xp.toLocaleString()} XP`;
        }));

        const embed = new EmbedBuilder()
            .setColor(config.colors.primary)
            .setTitle(`🏆 XP Leaderboard - ${interaction.guild.name}`)
            .setDescription(entries.join('\n\n'))
            .setFooter({ text: `Page ${page}` });

        // Show requester's rank if not on current page
        const userXP = XPService.getUserXP(interaction.guildId, interaction.user.id);
        if (userXP.rank > offset + perPage || userXP.rank <= offset) {
            embed.addFields({
                name: 'Your Rank',
                value: `#${userXP.rank} • Level ${userXP.level} • ${userXP.xp.toLocaleString()} XP`,
            });
        }

        await interaction.editReply({ embeds: [embed] });
    },
};
