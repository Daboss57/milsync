/**
 * Unlink Command - Remove account link
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const VerificationService = require('../../services/verificationService');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unlink')
        .setDescription('Unlink your Roblox account from Discord'),

    async execute(interaction) {
        await interaction.deferReply({ flags: 64 /* MessageFlags.Ephemeral */ });

        const result = VerificationService.unlinkAccount(interaction.user.id, interaction.guildId);

        if (!result.success) {
            return interaction.editReply({
                content: `❌ ${result.message}`,
            });
        }

        const embed = new EmbedBuilder()
            .setColor(config.colors.success)
            .setTitle('✅ Account Unlinked')
            .setDescription(`Your Discord account has been unlinked from **${result.robloxUsername}**.`)
            .setFooter({ text: 'Use /verify to link a different account' });

        await interaction.editReply({ embeds: [embed] });
    },
};
