/**
 * Give XP Command - Award XP to a user (Admin)
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const XPService = require('../../services/xpService');
const AuditLogRepository = require('../../database/repositories/auditLog');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('givexp')
        .setDescription('Give XP to a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to give XP to')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount of XP to give')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100000)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for giving XP')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const reason = interaction.options.getString('reason') || 'Admin granted';

        const result = XPService.awardCustomXP(interaction.guildId, targetUser.id, amount, reason);

        // Log action
        AuditLogRepository.log(interaction.guildId, 'XP_GRANT', interaction.user.id, {
            targetDiscordId: targetUser.id,
            newValue: amount.toString(),
            extra: { reason },
        });

        const embed = new EmbedBuilder()
            .setColor(config.colors.success)
            .setTitle('✅ XP Granted')
            .setDescription(`Gave **${amount.toLocaleString()} XP** to ${targetUser}`)
            .addFields(
                { name: 'Reason', value: reason, inline: true },
                { name: 'New Total', value: result.xp.toLocaleString(), inline: true }
            );

        if (result.leveledUp) {
            embed.addFields({ name: '🎉 Level Up!', value: `Now level ${result.newLevel}` });
        }

        await interaction.reply({ embeds: [embed] });
    },
};
