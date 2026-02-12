/**
 * Stats Command - View server statistics
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const LinkedAccountsRepository = require('../../database/repositories/linkedAccounts');
const BindingsRepository = require('../../database/repositories/bindings');
const XPRepository = require('../../database/repositories/xp');
const ApplicationsRepository = require('../../database/repositories/applications');
const AuditLogRepository = require('../../database/repositories/auditLog');
const { getDatabase } = require('../../database/init');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View server statistics')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        await interaction.deferReply();

        const db = getDatabase();

        // Get various statistics
        const verifiedCount = db.prepare(`
            SELECT COUNT(*) as count FROM linked_accounts
        `).get().count;

        const bindingsCount = BindingsRepository.getByGuild(interaction.guildId).length;

        const xpUsers = db.prepare(`
            SELECT COUNT(*) as count FROM user_xp WHERE guild_id = ?
        `).get(interaction.guildId).count;

        const totalXP = db.prepare(`
            SELECT SUM(xp) as total FROM user_xp WHERE guild_id = ?
        `).get(interaction.guildId).total || 0;

        const appStats = ApplicationsRepository.getStats(interaction.guildId);
        const pendingApps = appStats.find(s => s.status === 'pending')?.count || 0;

        const recentLogs = AuditLogRepository.getRecent(interaction.guildId, 100);
        const promotions = recentLogs.filter(l => l.action_type === 'PROMOTION').length;
        const demotions = recentLogs.filter(l => l.action_type === 'DEMOTION').length;

        const embed = new EmbedBuilder()
            .setColor(config.colors.primary)
            .setTitle(`📊 ${interaction.guild.name} Statistics`)
            .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
            .addFields(
                { name: '👥 Total Members', value: interaction.guild.memberCount.toString(), inline: true },
                { name: '✅ Verified Users', value: verifiedCount.toString(), inline: true },
                { name: '🔗 Role Bindings', value: bindingsCount.toString(), inline: true },
                { name: '📈 XP Tracking', value: `${xpUsers} users`, inline: true },
                { name: '⭐ Total XP Earned', value: totalXP.toLocaleString(), inline: true },
                { name: '📋 Pending Apps', value: pendingApps.toString(), inline: true },
                { name: '⬆️ Recent Promotions', value: promotions.toString(), inline: true },
                { name: '⬇️ Recent Demotions', value: demotions.toString(), inline: true }
            )
            .setFooter({ text: 'Statistics for the last 100 logged actions' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },
};
