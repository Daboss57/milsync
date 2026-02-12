/**
 * Logs Command - View audit logs
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const AuditLogRepository = require('../../database/repositories/auditLog');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('logs')
        .setDescription('View audit logs')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Filter by action type')
                .setRequired(false)
                .addChoices(
                    { name: 'All', value: 'all' },
                    { name: 'Promotions', value: 'PROMOTION' },
                    { name: 'Demotions', value: 'DEMOTION' },
                    { name: 'Verifications', value: 'VERIFICATION' },
                    { name: 'Bindings', value: 'BINDING' },
                    { name: 'Config Changes', value: 'CONFIG_CHANGE' }
                )
        )
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Filter by user')
                .setRequired(false)
        )
        .addIntegerOption(option =>
            option.setName('limit')
                .setDescription('Number of logs to show (default: 10)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(50)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        await interaction.deferReply({ flags: 64 /* MessageFlags.Ephemeral */ });

        const type = interaction.options.getString('type') || 'all';
        const user = interaction.options.getUser('user');
        const limit = interaction.options.getInteger('limit') || 10;

        let logs;
        if (user) {
            logs = AuditLogRepository.getByUser(interaction.guildId, user.id, limit);
        } else if (type !== 'all') {
            logs = AuditLogRepository.getByType(interaction.guildId, type, limit);
        } else {
            logs = AuditLogRepository.getRecent(interaction.guildId, limit);
        }

        if (logs.length === 0) {
            return interaction.editReply({
                content: '❌ No logs found matching the criteria.',
            });
        }

        const embed = new EmbedBuilder()
            .setColor(config.colors.primary)
            .setTitle('📜 Audit Logs')
            .setDescription(`Showing ${logs.length} log(s)${user ? ` for ${user}` : ''}${type !== 'all' ? ` of type "${type}"` : ''}`);

        const logEntries = await Promise.all(logs.map(async (log) => {
            const actor = log.actor_discord_id 
                ? await interaction.client.users.fetch(log.actor_discord_id).catch(() => null)
                : null;
            const target = log.target_discord_id 
                ? await interaction.client.users.fetch(log.target_discord_id).catch(() => null)
                : null;

            const timestamp = Math.floor(new Date(log.created_at).getTime() / 1000);
            let description = `**${log.action_type}** <t:${timestamp}:R>`;
            
            if (actor) description += `\nBy: ${actor.tag}`;
            if (target) description += `\nTarget: ${target.tag}`;
            if (log.old_value && log.new_value) {
                description += `\n\`${log.old_value}\` → \`${log.new_value}\``;
            }

            return description;
        }));

        // Split into fields if needed
        const chunkedEntries = [];
        let currentChunk = '';
        for (const entry of logEntries) {
            if ((currentChunk + '\n\n' + entry).length > 1024) {
                chunkedEntries.push(currentChunk);
                currentChunk = entry;
            } else {
                currentChunk += (currentChunk ? '\n\n' : '') + entry;
            }
        }
        if (currentChunk) chunkedEntries.push(currentChunk);

        chunkedEntries.forEach((chunk, i) => {
            embed.addFields({ 
                name: i === 0 ? 'Recent Activity' : 'Continued', 
                value: chunk 
            });
        });

        await interaction.editReply({ embeds: [embed] });
    },
};
