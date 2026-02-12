/**
 * Sync All Command - Sync roles for all members (Admin)
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const RoleSyncService = require('../../services/roleSyncService');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('syncall')
        .setDescription('Sync roles for all verified members in the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();

        const progressEmbed = new EmbedBuilder()
            .setColor(config.colors.info)
            .setTitle('🔄 Syncing All Members')
            .setDescription('This may take a while for large servers...')
            .addFields({ name: 'Progress', value: 'Starting...' });

        await interaction.editReply({ embeds: [progressEmbed] });

        // Progress callback to update the message
        let lastUpdate = 0;
        const progressCallback = async (current, total) => {
            const now = Date.now();
            if (now - lastUpdate > 3000) { // Update every 3 seconds
                lastUpdate = now;
                progressEmbed.spliceFields(0, 1, {
                    name: 'Progress',
                    value: `${current}/${total} members processed (${Math.round(current/total*100)}%)`,
                });
                try {
                    await interaction.editReply({ embeds: [progressEmbed] });
                } catch (e) {
                    // Ignore edit errors
                }
            }
        };

        const results = await RoleSyncService.syncGuild(interaction.guild, progressCallback);

        const embed = new EmbedBuilder()
            .setColor(results.failed > 0 ? config.colors.warning : config.colors.success)
            .setTitle('✅ Sync Complete')
            .setDescription(`Finished syncing roles for all members.`)
            .addFields(
                { name: 'Total Members', value: results.total.toString(), inline: true },
                { name: 'Synced', value: results.synced.toString(), inline: true },
                { name: 'Skipped', value: results.skipped.toString(), inline: true },
                { name: 'Failed', value: results.failed.toString(), inline: true }
            );

        if (results.errors.length > 0 && results.errors.length <= 5) {
            embed.addFields({
                name: 'Errors',
                value: results.errors.slice(0, 5).map(e => e.error).join('\n'),
            });
        }

        await interaction.editReply({ embeds: [embed] });
    },
};
