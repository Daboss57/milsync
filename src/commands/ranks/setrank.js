/**
 * SetRank Command - Set a user to a specific rank
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const RankService = require('../../services/rankService');
const RoleSyncService = require('../../services/roleSyncService');
const robloxService = require('../../services/robloxService');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setrank')
        .setDescription('Set a user to a specific rank in the Roblox group')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The Discord user to change rank')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('rank')
                .setDescription('The rank name or number to set')
                .setRequired(true)
                .setAutocomplete(true)
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
        const rank = interaction.options.getString('rank');
        const groupId = interaction.options.getString('group');

        const result = await RankService.setRank(
            interaction.guildId,
            targetUser.id,
            interaction.user.id,
            rank,
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

        // Sync roles
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        let rolesSynced = false;
        if (member) {
            const syncResult = await RoleSyncService.syncMember(member, interaction.guildId, groupId);
            rolesSynced = syncResult.success;
        }

        const embed = new EmbedBuilder()
            .setColor(config.colors.success)
            .setTitle('🎖️ Rank Changed')
            .setDescription(`Successfully changed rank for **${result.robloxUsername}**.`)
            .addFields(
                { name: 'Previous Rank', value: result.oldRank, inline: true },
                { name: 'New Rank', value: result.newRank, inline: true },
                { name: 'Changed By', value: interaction.user.toString(), inline: true }
            )
            .setTimestamp();

        if (rolesSynced) {
            embed.setFooter({ text: 'Discord roles have been updated' });
        }

        await interaction.editReply({ embeds: [embed] });

        // Log to audit channel
        await logToChannel(interaction.guild, embed);
    },

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const groupId = interaction.options.getString('group') || config.roblox.defaultGroupId;

        if (!groupId) {
            return interaction.respond([]);
        }

        try {
            const roles = await robloxService.getGroupRoles(groupId);
            const filtered = roles
                .filter(role =>
                    role.name.toLowerCase().includes(focusedValue) ||
                    role.rank.toString().includes(focusedValue)
                )
                .slice(0, 25)
                .map(role => ({
                    name: `${role.name} (Rank ${role.rank})`,
                    value: role.rank.toString(),
                }));

            await interaction.respond(filtered);
        } catch (error) {
            await interaction.respond([]);
        }
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
