/**
 * Groupbinds Command - List all group bindings in RoWifi-style display
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const GroupBindingsRepository = require('../../database/repositories/groupBindings');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('groupbinds')
        .setDescription('View all group bindings for this server')
        .addStringOption(option =>
            option.setName('group')
                .setDescription('Filter by group ID')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        const groupId = interaction.options.getString('group');

        const bindings = groupId
            ? GroupBindingsRepository.getByGuildAndGroup(interaction.guildId, groupId)
            : GroupBindingsRepository.getByGuild(interaction.guildId);

        if (bindings.length === 0) {
            return interaction.reply({
                content: '❌ No group bindings have been configured. Use `/groupbind` to create one.',
                flags: 64 /* MessageFlags.Ephemeral */,
            });
        }

        // Group bindings by group ID
        const groupedByGroup = {};
        for (const binding of bindings) {
            if (!groupedByGroup[binding.group_id]) {
                groupedByGroup[binding.group_id] = {
                    roles: [],
                    highestPriority: 0,
                    template: null,
                };
            }
            const group = groupedByGroup[binding.group_id];
            group.roles.push(binding.discord_role_id);

            if ((binding.priority || 0) > group.highestPriority) {
                group.highestPriority = binding.priority || 0;
            }
            if (binding.nickname_template && !group.template) {
                group.template = binding.nickname_template;
            }
        }

        // Build embed(s)
        const embeds = [];

        const embed = new EmbedBuilder()
            .setColor(config.colors.primary)
            .setTitle('Groupbinds')
            .setDescription(`${Object.keys(groupedByGroup).length} group(s) configured`);

        for (const [grpId, data] of Object.entries(groupedByGroup)) {
            const lines = [];
            if (data.template) lines.push(`Template: ${data.template}`);
            lines.push(`Priority: ${data.highestPriority}`);
            lines.push(`Roles: ${data.roles.map(r => `<@&${r}>`).join(' ')}`);

            embed.addFields({
                name: `Group: ${grpId}`,
                value: lines.join('\n'),
                inline: true,
            });

            // Discord limit: 25 fields per embed
            if (embed.data.fields.length >= 25) {
                embeds.push(embed);
                break;
            }
        }

        if (!embeds.includes(embed)) {
            embeds.push(embed);
        }

        embeds[embeds.length - 1].setFooter({ text: 'Use /groupbind to add or /groupunbind to remove' });

        await interaction.reply({ embeds });
    },
};
