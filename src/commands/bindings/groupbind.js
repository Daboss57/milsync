/**
 * Groupbind Command - Create binding between Roblox group membership and Discord roles
 * If a user is in the specified group, they receive the bound Discord role(s)
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const GroupBindingsRepository = require('../../database/repositories/groupBindings');
const AuditLogRepository = require('../../database/repositories/auditLog');
const robloxService = require('../../services/robloxService');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('groupbind')
        .setDescription('Bind Roblox group membership to Discord role(s)')
        .addStringOption(option =>
            option.setName('group_id')
                .setDescription('The Roblox group ID to bind membership to')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('roles')
                .setDescription('Discord roles to bind (mention or name, comma-separated)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('template')
                .setDescription('Nickname template, e.g. {roblox-username}')
                .setRequired(false)
        )
        .addIntegerOption(option =>
            option.setName('priority')
                .setDescription('Priority (higher = takes precedence for nickname). Default: 0')
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(100)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();

        const groupId = interaction.options.getString('group_id');
        const rolesInput = interaction.options.getString('roles');
        const template = interaction.options.getString('template') || null;
        const priority = interaction.options.getInteger('priority') ?? 0;

        // Verify the group exists
        const groupInfo = await robloxService.getGroupInfo(groupId);
        if (!groupInfo) {
            return interaction.editReply({
                content: `❌ Could not find Roblox group with ID \`${groupId}\`. Make sure the group ID is correct.`,
            });
        }

        // Parse roles from input — supports @mentions or names separated by commas
        const resolvedRoles = [];
        const failedRoles = [];

        // First, extract all <@&ID> mentions
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

        // If no mentions found, try splitting by comma and matching by name/ID
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
            GroupBindingsRepository.create(
                interaction.guildId,
                groupId,
                role.id,
                role.name,
                priority,
                template
            );
        }

        // Log the action
        AuditLogRepository.logBindingChange(interaction.guildId, interaction.user.id, 'CREATE_GROUP', {
            groupId,
            groupName: groupInfo.name,
            discordRoles: resolvedRoles.map(r => ({ id: r.id, name: r.name })),
            priority,
            template,
        });

        const embed = new EmbedBuilder()
            .setColor(config.colors.success)
            .setTitle('✅ Group Binding Created')
            .setDescription(`Members of **${groupInfo.name}** will receive ${resolvedRoles.length} role(s).`)
            .addFields(
                { name: 'Roblox Group', value: `${groupInfo.name} (\`${groupId}\`)`, inline: true },
                { name: 'Discord Roles', value: resolvedRoles.map(r => r.toString()).join(', '), inline: true },
                { name: 'Priority', value: priority.toString(), inline: true },
            );

        if (template) {
            embed.addFields({ name: 'Nickname Template', value: `\`${template}\``, inline: false });
        }

        if (failedRoles.length > 0) {
            embed.addFields({ name: '⚠️ Not Found', value: failedRoles.join(', '), inline: false });
        }

        embed.setFooter({ text: 'Vars: {roblox-username}, {display-name}, {discord-name} | /update to sync' });

        await interaction.editReply({ embeds: [embed] });
    },
};
