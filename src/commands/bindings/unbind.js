/**
 * Unbind Command - Remove a role binding
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const BindingsRepository = require('../../database/repositories/bindings');
const AuditLogRepository = require('../../database/repositories/auditLog');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unbind')
        .setDescription('Remove a binding between a Roblox rank and a Discord role')
        .addIntegerOption(option =>
            option.setName('rank')
                .setDescription('The Roblox rank number to unbind')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(255)
        )
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Specific Discord role to unbind (removes all if not specified)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('group')
                .setDescription('Group ID (uses default if not specified)')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const rankNumber = interaction.options.getInteger('rank');
        const role = interaction.options.getRole('role');
        const groupId = interaction.options.getString('group') || config.roblox.defaultGroupId;

        if (!groupId) {
            return interaction.reply({
                content: '❌ No group specified and no default group is configured.',
                flags: 64 /* MessageFlags.Ephemeral */,
            });
        }

        // Delete the binding(s)
        const result = BindingsRepository.delete(interaction.guildId, groupId, rankNumber, role?.id);

        if (result.changes === 0) {
            const roleText = role ? ` for role ${role}` : '';
            return interaction.reply({
                content: `❌ No binding found for rank ${rankNumber}${roleText} in group ${groupId}.`,
                flags: 64 /* MessageFlags.Ephemeral */,
            });
        }

        // Log the action
        AuditLogRepository.logBindingChange(interaction.guildId, interaction.user.id, 'DELETE', {
            groupId,
            robloxRank: rankNumber,
            discordRole: role?.id,
        });

        const embed = new EmbedBuilder()
            .setColor(config.colors.success)
            .setTitle('✅ Binding Removed')
            .setDescription(role 
                ? `Removed binding: Rank ${rankNumber} → ${role}`
                : `Removed all bindings for rank ${rankNumber} (${result.changes} role${result.changes > 1 ? 's' : ''}).`
            )
            .addFields(
                { name: 'Rank', value: rankNumber.toString(), inline: true },
                { name: 'Group ID', value: groupId, inline: true }
            );

        await interaction.reply({ embeds: [embed] });
    },
};
