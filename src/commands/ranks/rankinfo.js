/**
 * Rankinfo Command - Get rank information for a user
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const RankService = require('../../services/rankService');
const robloxService = require('../../services/robloxService');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rankinfo')
        .setDescription('View current rank information for a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The Discord user to check (defaults to yourself)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('group')
                .setDescription('Group ID (uses default if not specified)')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('user') || interaction.user;
        const groupId = interaction.options.getString('group') || config.roblox.defaultGroupId;

        const result = await RankService.getRankInfo(targetUser.id, groupId);

        if (!result.success) {
            const errorMessages = {
                'not_verified': `${targetUser.id === interaction.user.id ? 'You are' : `${targetUser} is`} not verified.`,
                'no_group': 'No group specified and no default group is configured.',
            };

            return interaction.editReply({
                content: `❌ ${errorMessages[result.error] || result.message || result.error || 'Unknown error'}`,
            });
        }

        // Get group info
        let groupInfo = null;
        if (groupId) {
            groupInfo = await robloxService.getGroupInfo(groupId);
        }

        const embed = new EmbedBuilder()
            .setColor(config.colors.primary)
            .setTitle(`🎖️ Rank Information`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }));

        if (groupInfo) {
            embed.addFields({ name: 'Group', value: groupInfo.name, inline: true });
        }

        embed.addFields(
            { name: 'Roblox Username', value: result.robloxUsername, inline: true },
            { name: 'In Group', value: result.inGroup ? '✅ Yes' : '❌ No', inline: true }
        );

        if (result.inGroup) {
            embed.addFields(
                { name: 'Current Rank', value: result.rankName || 'Unknown', inline: true },
                { name: 'Rank Number', value: result.rank?.toString() || 'N/A', inline: true }
            );
        }

        await interaction.editReply({ embeds: [embed] });
    },
};
