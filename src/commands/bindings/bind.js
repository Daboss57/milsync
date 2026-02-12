/**
 * Bind Command - Create role binding between Roblox rank and Discord role
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const BindingsRepository = require('../../database/repositories/bindings');
const AuditLogRepository = require('../../database/repositories/auditLog');
const robloxService = require('../../services/robloxService');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bind')
        .setDescription('Create a binding between a Roblox rank and a Discord role')
        .addIntegerOption(option =>
            option.setName('rank')
                .setDescription('The Roblox rank number to bind')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(255)
        )
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The Discord role to bind')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('group')
                .setDescription('Group ID (uses default if not specified)')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();

        const rankNumber = interaction.options.getInteger('rank');
        const role = interaction.options.getRole('role');
        const groupId = interaction.options.getString('group') || config.roblox.defaultGroupId;

        if (!groupId) {
            return interaction.editReply({
                content: '❌ No group specified and no default group is configured.',
            });
        }

        // Get group roles to verify the rank exists
        const roles = await robloxService.getGroupRoles(groupId);
        const robloxRole = roles.find(r => r.rank === rankNumber);

        if (!robloxRole) {
            return interaction.editReply({
                content: `❌ Rank ${rankNumber} does not exist in the group. Use \`/ranks\` to see available ranks.`,
            });
        }

        // Check if the bot can manage this role
        if (role.position >= interaction.guild.members.me.roles.highest.position) {
            return interaction.editReply({
                content: `❌ I cannot manage the ${role} role. Please move my role above it in the server settings.`,
            });
        }

        // Create the binding
        BindingsRepository.create(
            interaction.guildId,
            groupId,
            rankNumber,
            robloxRole.name,
            role.id,
            role.name
        );

        // Log the action
        AuditLogRepository.logBindingChange(interaction.guildId, interaction.user.id, 'CREATE', {
            groupId,
            robloxRank: rankNumber,
            robloxRankName: robloxRole.name,
            discordRole: role.id,
            discordRoleName: role.name,
        });

        const embed = new EmbedBuilder()
            .setColor(config.colors.success)
            .setTitle('✅ Binding Created')
            .setDescription(`Successfully bound Roblox rank to Discord role.`)
            .addFields(
                { name: 'Roblox Rank', value: `${robloxRole.name} (${rankNumber})`, inline: true },
                { name: 'Discord Role', value: role.toString(), inline: true },
                { name: 'Group ID', value: groupId, inline: true }
            )
            .setFooter({ text: 'Use /update to sync roles for yourself' });

        await interaction.editReply({ embeds: [embed] });
    },
};
