/**
 * Ranks Command - List all ranks in a Roblox group
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const robloxService = require('../../services/robloxService');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ranks')
        .setDescription('View all ranks in the Roblox group')
        .addStringOption(option =>
            option.setName('group')
                .setDescription('Group ID (uses default if not specified)')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const groupId = interaction.options.getString('group') || config.roblox.defaultGroupId;

        if (!groupId) {
            return interaction.editReply({
                content: '❌ No group specified and no default group is configured.',
            });
        }

        // Get group info and roles
        const [groupInfo, roles] = await Promise.all([
            robloxService.getGroupInfo(groupId),
            robloxService.getGroupRoles(groupId),
        ]);

        if (!roles || roles.length === 0) {
            return interaction.editReply({
                content: '❌ Could not fetch ranks for this group.',
            });
        }

        // Sort roles by rank number (descending)
        const sortedRoles = roles.sort((a, b) => b.rank - a.rank);

        const embed = new EmbedBuilder()
            .setColor(config.colors.primary)
            .setTitle(`🎖️ ${groupInfo?.name || 'Group'} Ranks`)
            .setDescription(`Group ID: \`${groupId}\``);

        // Create role list
        const roleList = sortedRoles
            .map(role => `\`${role.rank.toString().padStart(3, ' ')}\` - ${role.name} (${role.memberCount || 0} members)`)
            .join('\n');

        if (roleList.length <= 4096) {
            embed.setDescription(embed.data.description + '\n\n' + roleList);
        } else {
            // Split into fields
            const chunks = roleList.match(/.{1,1024}(?:\n|$)/g);
            chunks.forEach((chunk, i) => {
                embed.addFields({ 
                    name: i === 0 ? 'Ranks' : 'Ranks (cont.)', 
                    value: chunk 
                });
            });
        }

        embed.setFooter({ text: `Total: ${sortedRoles.length} ranks` });

        await interaction.editReply({ embeds: [embed] });
    },
};
