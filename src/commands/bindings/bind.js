/**
 * Bind Command - Create role binding between Roblox rank and Discord roles
 * RoWifi-style with priority, nickname template, and multi-role support
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const BindingsRepository = require('../../database/repositories/bindings');
const AuditLogRepository = require('../../database/repositories/auditLog');
const robloxService = require('../../services/robloxService');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bind')
        .setDescription('Bind a Roblox rank to Discord role(s) with optional nickname template')
        .addIntegerOption(option =>
            option.setName('rank')
                .setDescription('The Roblox rank number to bind')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(255)
        )
        .addStringOption(option =>
            option.setName('roles')
                .setDescription('Discord roles to bind (mention or name, comma-separated, e.g. @E1, @Enlisted)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('template')
                .setDescription('Nickname template, e.g. [E1] {roblox-username}')
                .setRequired(false)
        )
        .addIntegerOption(option =>
            option.setName('priority')
                .setDescription('Priority (higher = takes precedence for nickname). Default: 0')
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(100)
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
        const rolesInput = interaction.options.getString('roles');
        const template = interaction.options.getString('template') || null;
        const priority = interaction.options.getInteger('priority') ?? 0;
        const groupId = interaction.options.getString('group') || config.roblox.defaultGroupId;

        if (!groupId) {
            return interaction.editReply({
                content: '❌ No group specified and no default group is configured.',
            });
        }

        // Parse roles from input — supports @mentions separated by spaces, or names separated by commas
        const resolvedRoles = [];
        const failedRoles = [];

        // First, extract all <@&ID> mentions from the raw string
        const mentionRegex = /<@&(\d+)>/g;
        let match;
        while ((match = mentionRegex.exec(rolesInput)) !== null) {
            const role = interaction.guild.roles.cache.get(match[1]);
            if (role) {
                resolvedRoles.push(role);
            } else {
                failedRoles.push(match[0]);
            }
        }

        // If no mentions found, try splitting by comma or space and matching by name/ID
        if (resolvedRoles.length === 0 && failedRoles.length === 0) {
            const roleParts = rolesInput.split(/[,]+/).map(s => s.trim()).filter(Boolean);
            for (const part of roleParts) {
                let role = null;

                // Try raw ID
                if (/^\d+$/.test(part)) {
                    role = interaction.guild.roles.cache.get(part);
                }

                // Try role name (case-insensitive)
                if (!role) {
                    role = interaction.guild.roles.cache.find(
                        r => r.name.toLowerCase() === part.toLowerCase()
                    );
                }

                if (role) {
                    resolvedRoles.push(role);
                } else {
                    failedRoles.push(part);
                }
            }
        }

        if (resolvedRoles.length === 0) {
            return interaction.editReply({
                content: `❌ Could not find any valid roles. Make sure to @mention them or type the exact role name.\nFailed: ${failedRoles.join(', ')}`,
            });
        }

        // Get group roles to verify the rank exists
        const groupRoles = await robloxService.getGroupRoles(groupId);
        const robloxRole = groupRoles.find(r => r.rank === rankNumber);

        if (!robloxRole) {
            return interaction.editReply({
                content: `❌ Rank ${rankNumber} does not exist in the group. Use \`/ranks\` to see available ranks.`,
            });
        }

        // Check if the bot can manage all roles
        const botHighest = interaction.guild.members.me.roles.highest.position;
        const tooHigh = resolvedRoles.filter(r => r.position >= botHighest);
        if (tooHigh.length > 0) {
            return interaction.editReply({
                content: `❌ I cannot manage these roles (above me): ${tooHigh.map(r => r.toString()).join(', ')}`,
            });
        }

        // Create a binding for each role
        for (const role of resolvedRoles) {
            BindingsRepository.create(
                interaction.guildId,
                groupId,
                rankNumber,
                robloxRole.name,
                role.id,
                role.name,
                priority,
                template
            );
        }

        // Log the action
        AuditLogRepository.logBindingChange(interaction.guildId, interaction.user.id, 'CREATE', {
            groupId,
            robloxRank: rankNumber,
            robloxRankName: robloxRole.name,
            discordRoles: resolvedRoles.map(r => ({ id: r.id, name: r.name })),
            priority,
            template,
        });

        const embed = new EmbedBuilder()
            .setColor(config.colors.success)
            .setTitle('✅ Binding Created')
            .setDescription(`Bound **${robloxRole.name}** (rank ${rankNumber}) to ${resolvedRoles.length} role(s).`)
            .addFields(
                { name: 'Roblox Rank', value: `${robloxRole.name} (${rankNumber})`, inline: true },
                { name: 'Discord Roles', value: resolvedRoles.map(r => r.toString()).join(', '), inline: true },
                { name: 'Priority', value: priority.toString(), inline: true },
            );

        if (template) {
            embed.addFields({ name: 'Nickname Template', value: `\`${template}\``, inline: false });
        }

        if (failedRoles.length > 0) {
            embed.addFields({ name: '⚠️ Not Found', value: failedRoles.join(', '), inline: false });
        }

        embed.setFooter({ text: 'Vars: {roblox-username}, {display-name}, {discord-name}, {rank-name} | /update to sync' });

        await interaction.editReply({ embeds: [embed] });
    },
};
