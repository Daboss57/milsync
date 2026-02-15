/**
 * Groupunbind Command - Remove a group binding
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const GroupBindingsRepository = require('../../database/repositories/groupBindings');
const AuditLogRepository = require('../../database/repositories/auditLog');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('groupunbind')
        .setDescription('Remove a group binding')
        .addStringOption(option =>
            option.setName('group_id')
                .setDescription('The Roblox group ID to unbind')
                .setRequired(true)
        )
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Specific Discord role to unbind (removes all if not specified)')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const groupId = interaction.options.getString('group_id');
        const role = interaction.options.getRole('role');

        // Delete the binding(s)
        const result = GroupBindingsRepository.delete(interaction.guildId, groupId, role?.id);

        if (result.changes === 0) {
            const roleText = role ? ` for role ${role}` : '';
            return interaction.reply({
                content: `❌ No group binding found for group ${groupId}${roleText}.`,
                flags: 64 /* MessageFlags.Ephemeral */,
            });
        }

        // Log the action
        AuditLogRepository.logBindingChange(interaction.guildId, interaction.user.id, 'DELETE_GROUP', {
            groupId,
            discordRole: role?.id,
        });

        const embed = new EmbedBuilder()
            .setColor(config.colors.success)
            .setTitle('✅ Group Binding Removed')
            .setDescription(role
                ? `Removed group binding: Group ${groupId} → ${role}`
                : `Removed all bindings for group ${groupId} (${result.changes} role${result.changes > 1 ? 's' : ''}).`
            )
            .addFields(
                { name: 'Group ID', value: groupId, inline: true },
            );

        if (role) {
            embed.addFields({ name: 'Role', value: role.toString(), inline: true });
        }

        await interaction.reply({ embeds: [embed] });
    },
};
