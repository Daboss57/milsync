/**
 * Bindings Command - List all role bindings
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const BindingsRepository = require('../../database/repositories/bindings');
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

        if (bindings.length === 0) {
            return interaction.reply({
                content: '❌ No role bindings have been configured. Use `/bind` to create one.',
                flags: 64 /* MessageFlags.Ephemeral */,
            });
        }

        // Group bindings by group ID
        const groupedBindings = {};
        for (const binding of bindings) {
            if (!groupedBindings[binding.group_id]) {
                groupedBindings[binding.group_id] = [];
            }
            groupedBindings[binding.group_id].push(binding);
        }

        const embed = new EmbedBuilder()
            .setColor(config.colors.primary)
            .setTitle('📋 Role Bindings')
            .setDescription(`Found ${bindings.length} binding(s) in this server.`);

        for (const [grpId, grpBindings] of Object.entries(groupedBindings)) {
            // Group by rank to show multiple roles per rank
            const byRank = {};
            for (const b of grpBindings) {
                if (!byRank[b.roblox_rank_id]) {
                    byRank[b.roblox_rank_id] = { name: b.roblox_rank_name, roles: [] };
                }
                byRank[b.roblox_rank_id].roles.push(`<@&${b.discord_role_id}>`);
            }

            const bindingList = Object.entries(byRank)
                .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
                .map(([rankId, data]) => {
                    const rolesStr = data.roles.join(', ');
                    return `\`${rankId}\` ${data.name || 'Unknown'} → ${rolesStr}`;
                })
                .join('\n');

            // Split into multiple fields if too long
            if (bindingList.length <= 1024) {
                embed.addFields({ name: `Group: ${grpId}`, value: bindingList });
            } else {
                const chunks = bindingList.match(/.{1,1024}(?:\n|$)/g);
                chunks.forEach((chunk, i) => {
                    embed.addFields({ 
                        name: i === 0 ? `Group: ${grpId}` : `Group: ${grpId} (cont.)`, 
                        value: chunk 
                    });
                });
            }
        }

        embed.setFooter({ text: 'Use /bind to add or /unbind to remove bindings' });

        await interaction.reply({ embeds: [embed] });
    },
};
