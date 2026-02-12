/**
 * Demote Command - Demote a user in Roblox group
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const RankService = require('../../services/rankService');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('demote')
        .setDescription('Demote a user to the previous rank in the Roblox group')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The Discord user to demote')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('group')
                .setDescription('Group ID (uses default if not specified)')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        await interaction.deferReply();

        // Check for "ranking key" role
        const hasRankingKey = interaction.member.roles.cache.some(
            role => role.name.toLowerCase() === 'ranking key'
        );
        if (!hasRankingKey) {
            return interaction.editReply({
                content: '❌ You need the **Ranking Key** role to use this command.',
            });
        }

        const targetUser = interaction.options.getUser('user');
        const groupId = interaction.options.getString('group');

        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        const result = await RankService.demoteAndSync(
            interaction.guildId,
            targetUser.id,
            interaction.user.id,
            member,
            groupId
        );

        if (!result.success) {
            const errorMessages = {
                'not_verified': `${targetUser} is not verified. They need to use \`/verify\` first.`,
                'no_group': 'No group specified and no default group is configured.',
            };

            return interaction.editReply({
                content: `❌ ${errorMessages[result.error] || result.message || result.error || 'Unknown error'}`,
            });
        }

        const embed = new EmbedBuilder()
            .setColor(config.colors.warning)
            .setTitle('⬇️ User Demoted')
            .setDescription(`Successfully demoted **${result.robloxUsername}**.`)
            .addFields(
                { name: 'Previous Rank', value: result.oldRank, inline: true },
                { name: 'New Rank', value: result.newRank, inline: true },
                { name: 'Demoted By', value: interaction.user.toString(), inline: true }
            )
            .setTimestamp();

        if (result.rolesSynced) {
            embed.setFooter({ text: 'Discord roles have been updated' });
        }

        await interaction.editReply({ embeds: [embed] });

        // Log to audit channel if configured
        await logToChannel(interaction.guild, embed);
    },
};

async function logToChannel(guild, embed) {
    const GuildConfigRepository = require('../../database/repositories/guildConfig');
    const guildConfig = GuildConfigRepository.get(guild.id);

    if (guildConfig?.log_channel_id) {
        try {
            const channel = await guild.channels.fetch(guildConfig.log_channel_id);
            if (channel) {
                await channel.send({ embeds: [embed] });
            }
        } catch (error) {
            // Ignore logging errors
        }
    }
}
