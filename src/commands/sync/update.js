/**
 * Update Command - Sync Discord roles with Roblox ranks
 * Can update yourself or another user
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const RoleSyncService = require('../../services/roleSyncService');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('update')
        .setDescription('Sync Discord roles & nickname with Roblox ranks')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to update (defaults to yourself)')
                .setRequired(false)
        ),

    cooldown: config.rateLimits.syncCooldown,

    async execute(interaction) {
        await interaction.deferReply({ flags: 64 /* MessageFlags.Ephemeral */ });

        const targetUser = interaction.options.getUser('user') || interaction.user;
        const member = await interaction.guild.members.fetch(targetUser.id);
        const isSelf = targetUser.id === interaction.user.id;

        const result = await RoleSyncService.syncMember(member, interaction.guildId);

        if (!result.success) {
            const errorMessages = {
                'not_verified': isSelf
                    ? 'You need to verify your Roblox account first. Use `/verify` to get started.'
                    : `${targetUser} is not verified.`,
                'no_bindings': 'No role bindings have been configured for this server.',
            };

            return interaction.editReply({
                content: `❌ ${errorMessages[result.error] || result.message || result.error || 'Unknown error'}`,
            });
        }

        const embed = new EmbedBuilder()
            .setColor(config.colors.success)
            .setTitle('✅ Roles Synced')
            .setDescription(isSelf
                ? 'Your Discord roles have been updated based on your Roblox account.'
                : `Updated ${targetUser}'s roles based on their Roblox account.`
            )
            .addFields(
                { name: 'Roblox Account', value: result.robloxUsername, inline: true },
                { name: 'Roles Added', value: result.rolesAdded.toString(), inline: true },
                { name: 'Roles Removed', value: result.rolesRemoved.toString(), inline: true }
            );

        if (result.nicknameApplied) {
            embed.addFields({ name: 'Nickname Set', value: `\`${result.nicknameApplied}\``, inline: false });
        }

        await interaction.editReply({ embeds: [embed] });
    },
};
