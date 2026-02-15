/**
 * Bindings Command - List all role bindings in RoWifi-style grouped display
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const BindingsRepository = require('../../database/repositories/bindings');
const GroupBindingsRepository = require('../../database/repositories/groupBindings');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bindings')
        .setDescription('View all role bindings for this server')
        .addStringOption(option =>
            option.setName('group')
                .setDescription('Filter by group ID')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        const groupId = interaction.options.getString('group');

        const bindings = groupId
            ? BindingsRepository.getByGuildAndGroup(interaction.guildId, groupId)
            : BindingsRepository.getByGuild(interaction.guildId);

        const groupBindings = groupId
            ? GroupBindingsRepository.getByGuildAndGroup(interaction.guildId, groupId)
            : GroupBindingsRepository.getByGuild(interaction.guildId);

        if (bindings.length === 0 && groupBindings.length === 0) {
            return interaction.reply({
                content: '❌ No role bindings have been configured. Use `/bind` or `/groupbind` to create one.',
                flags: 64 /* MessageFlags.Ephemeral */,
            });
        }

        // Group bindings by group ID, then by rank
        const groupedByGroup = {};
        for (const binding of bindings) {
            if (!groupedByGroup[binding.group_id]) {
                groupedByGroup[binding.group_id] = {};
            }
            const key = binding.roblox_rank_id;
            if (!groupedByGroup[binding.group_id][key]) {
                groupedByGroup[binding.group_id][key] = {
                    rankName: binding.roblox_rank_name || 'Unknown',
                    priority: binding.priority || 0,
                    template: binding.nickname_template || null,
                    roles: [],
                };
            }
            groupedByGroup[binding.group_id][key].roles.push(binding.discord_role_id);
            // Use highest priority and first template found for this rank
            if ((binding.priority || 0) > groupedByGroup[binding.group_id][key].priority) {
                groupedByGroup[binding.group_id][key].priority = binding.priority || 0;
            }
            if (binding.nickname_template && !groupedByGroup[binding.group_id][key].template) {
                groupedByGroup[binding.group_id][key].template = binding.nickname_template;
            }
        }

        // Build embed(s) — RoWifi-style: one field per rank
        const embeds = [];

        for (const [grpId, ranks] of Object.entries(groupedByGroup)) {
            const embed = new EmbedBuilder()
                .setColor(config.colors.primary)
                .setTitle('Rankbinds')
                .setDescription(`Group ${grpId} | ${Object.keys(ranks).length} bind(s)`);

            const sortedRanks = Object.entries(ranks).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

            for (const [rankId, data] of sortedRanks) {
                const lines = [];
                if (data.template) lines.push(`Template: ${data.template}`);
                lines.push(`Priority: ${data.priority}`);
                lines.push(`Roles: ${data.roles.map(r => `<@&${r}>`).join(' ')}`);

                embed.addFields({
                    name: `Rank: ${rankId}`,
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
        }


        // Add group bindings section
        if (groupBindings.length > 0) {
            const groupedByGroup = {};
            for (const binding of groupBindings) {
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

            const groupEmbed = new EmbedBuilder()
                .setColor(config.colors.primary)
                .setTitle('Groupbinds')
                .setDescription(`${Object.keys(groupedByGroup).length} group(s) configured`);

            for (const [grpId, data] of Object.entries(groupedByGroup)) {
                const lines = [];
                if (data.template) lines.push(`Template: ${data.template}`);
                lines.push(`Priority: ${data.highestPriority}`);
                lines.push(`Roles: ${data.roles.map(r => `<@&${r}>`).join(' ')}`);

                groupEmbed.addFields({
                    name: `Group: ${grpId}`,
                    value: lines.join('\n'),
                    inline: true,
                });

                if (groupEmbed.data.fields.length >= 25) break;
            }

            embeds.push(groupEmbed);
        }

        // Set footer on the last embed
        if (embeds.length > 0) {
            embeds[embeds.length - 1].setFooter({ text: 'Use /bind, /unbind, /groupbind, /groupunbind to manage bindings' });
        }

        await interaction.reply({ embeds });
    },
};
