/**
 * XP Command - View XP and level information
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const XPService = require('../../services/xpService');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('xp')
        .setDescription('View your XP and level')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to check (defaults to yourself)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const xpInfo = XPService.getUserXP(interaction.guildId, targetUser.id);

        const progressBar = createProgressBar(xpInfo.progressPercent);

        const embed = new EmbedBuilder()
            .setColor(config.colors.primary)
            .setTitle(`📊 ${targetUser.username}'s XP`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: 'Level', value: `**${xpInfo.level}**`, inline: true },
                { name: 'Total XP', value: `**${xpInfo.xp.toLocaleString()}**`, inline: true },
                { name: 'Rank', value: `#${xpInfo.rank}`, inline: true },
                { name: 'Progress to Next Level', value: `${progressBar}\n${xpInfo.progress.toLocaleString()} / ${xpInfo.needed.toLocaleString()} XP (${xpInfo.progressPercent}%)` },
                { name: 'Messages', value: xpInfo.totalMessages.toLocaleString(), inline: true },
                { name: 'Voice Time', value: `${Math.floor(xpInfo.voiceMinutes / 60)}h ${xpInfo.voiceMinutes % 60}m`, inline: true }
            );

        await interaction.reply({ embeds: [embed] });
    },
};

function createProgressBar(percent, length = 10) {
    const filled = Math.round(length * (percent / 100));
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}
