/**
 * Update Command - Sync Discord roles with Roblox ranks
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const RoleSyncService = require('../../services/roleSyncService');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('update')
        .setDescription('Sync your Discord roles with your Roblox ranks'),

    cooldown: config.rateLimits.syncCooldown,

    async execute(interaction) {
        await interaction.deferReply({ flags: 64 /* MessageFlags.Ephemeral */ });

        const member = await interaction.guild.members.fetch(interaction.user.id);
        const result = await RoleSyncService.syncMember(member, interaction.guildId);

        if (!result.success) {
            const errorMessages = {
                'not_verified': 'You need to verify your Roblox account first. Use `/verify` to get started.',
                'no_bindings': 'No role bindings have been configured for this server.',
            };

            return interaction.editReply({
                content: `❌ ${errorMessages[result.error] || result.message || result.error || 'Unknown error'}`,
            });
        }

        const embed = new EmbedBuilder()
            .setColor(config.colors.success)
            .setTitle('✅ Roles Synced')
            .setDescription(`Your Discord roles have been updated based on your Roblox account.`)
            .addFields(
                { name: 'Roblox Account', value: result.robloxUsername, inline: true },
                { name: 'Roles Added', value: result.rolesAdded.toString(), inline: true },
                { name: 'Roles Removed', value: result.rolesRemoved.toString(), inline: true }
            );

        await interaction.editReply({ embeds: [embed] });
    },
};
