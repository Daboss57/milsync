/**
 * MassRank Command - Rank multiple users at once
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const RankService = require('../../services/rankService');
const config = require('../../config');

// Build command with up to 10 user options
const builder = new SlashCommandBuilder()
    .setName('massrank')
    .setDescription('Set multiple users to a specific rank at once')
    .addStringOption(option =>
        option.setName('rank')
            .setDescription('The rank name or number to set')
            .setRequired(true)
            .setAutocomplete(true)
    )
    .addUserOption(option =>
        option.setName('user1')
            .setDescription('User 1 to rank')
            .setRequired(true)
    )
    .addStringOption(option =>
        option.setName('group')
            .setDescription('Group ID (uses default if not specified)')
            .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

// Add user options 2-10 (all optional)
for (let i = 2; i <= 10; i++) {
    builder.addUserOption(option =>
        option.setName(`user${i}`)
            .setDescription(`User ${i} to rank`)
            .setRequired(false)
    );
}

module.exports = {
    data: builder,

    async autocomplete(interaction) {
        const robloxService = require('../../services/robloxService');
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const groupId = interaction.options.getString('group') || config.roblox.defaultGroupId;

        try {
            const roles = await robloxService.getGroupRoles(groupId);
            const filtered = roles
                .filter(r => r.rank > 0) // Exclude Guest
                .filter(r =>
                    r.name.toLowerCase().includes(focusedValue) ||
                    r.rank.toString().includes(focusedValue)
                )
                .sort((a, b) => a.rank - b.rank)
                .slice(0, 25);

            await interaction.respond(
                filtered.map(r => ({
                    name: `${r.name} (Rank ${r.rank})`,
                    value: r.rank.toString(),
                }))
            );
        } catch (error) {
            await interaction.respond([]);
        }
    },

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

        const rank = interaction.options.getString('rank');
        const groupId = interaction.options.getString('group');

        // Collect all specified users (up to 10)
        const users = [];
        for (let i = 1; i <= 10; i++) {
            const user = interaction.options.getUser(`user${i}`);
            if (user) users.push(user);
        }

        if (users.length === 0) {
            return interaction.editReply({ content: '❌ You must specify at least one user.' });
        }

        // Process all rank changes concurrently
        const results = await Promise.allSettled(
            users.map(async (user) => {
                const result = await RankService.setRank(
                    interaction.guildId,
                    user.id,
                    interaction.user.id,
                    rank,
                    groupId
                );

                // Sync Discord roles
                if (result.success) {
                    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
                    if (member) {
                        const RoleSyncService = require('../../services/roleSyncService');
                        await RoleSyncService.syncMember(member, interaction.guildId).catch(() => { });
                    }
                }

                return { user, result };
            })
        );

        // Build summary
        const successes = [];
        const failures = [];

        for (const entry of results) {
            if (entry.status === 'fulfilled') {
                const { user, result } = entry.value;
                if (result.success) {
                    successes.push(`✅ **${user.tag}** → ${result.newRank || rank}`);
                } else {
                    failures.push(`❌ **${user.tag}** — ${result.error || 'Unknown error'}`);
                }
            } else {
                failures.push(`❌ Error — ${entry.reason?.message || 'Unknown error'}`);
            }
        }

        const embed = new EmbedBuilder()
            .setColor(failures.length === 0 ? config.colors.success : (successes.length === 0 ? config.colors.error : config.colors.warning))
            .setTitle('📋 Mass Rank Results')
            .setDescription(
                `Ranked **${successes.length}/${users.length}** users successfully.`
            )
            .setFooter({ text: `Executed by ${interaction.user.tag}` })
            .setTimestamp();

        if (successes.length > 0) {
            embed.addFields({ name: 'Successes', value: successes.join('\n').slice(0, 1024) });
        }
        if (failures.length > 0) {
            embed.addFields({ name: 'Failures', value: failures.join('\n').slice(0, 1024) });
        }

        await interaction.editReply({ embeds: [embed] });
    },
};
