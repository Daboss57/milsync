/**
 * Whois Command - Get verification info for a user
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const VerificationService = require('../../services/verificationService');
const robloxService = require('../../services/robloxService');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whois')
        .setDescription('View Roblox account information for a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The Discord user to look up (defaults to yourself)')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('user') || interaction.user;
        const status = VerificationService.getVerificationStatus(targetUser.id);

        if (status.status === 'unverified') {
            return interaction.editReply({
                content: `❌ ${targetUser.id === interaction.user.id ? 'You are' : `${targetUser} is`} not verified.`,
            });
        }

        if (status.status === 'pending') {
            return interaction.editReply({
                content: `⏳ ${targetUser.id === interaction.user.id ? 'You have' : `${targetUser} has`} a pending verification.`,
            });
        }

        // Get Roblox user info
        const robloxUser = await robloxService.getUserById(status.robloxId);
        
        // Get group rank if configured
        let rankInfo = null;
        if (config.roblox.defaultGroupId) {
            rankInfo = await robloxService.getUserGroupRank(status.robloxId, config.roblox.defaultGroupId);
        }

        const embed = new EmbedBuilder()
            .setColor(config.colors.primary)
            .setTitle(`👤 ${targetUser.username}`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: 'Discord', value: `${targetUser}`, inline: true },
                { name: 'Roblox Username', value: robloxUser?.name || status.robloxUsername, inline: true },
                { name: 'Roblox ID', value: status.robloxId, inline: true }
            );

        if (robloxUser?.displayName && robloxUser.displayName !== robloxUser.name) {
            embed.addFields({ name: 'Display Name', value: robloxUser.displayName, inline: true });
        }

        if (rankInfo?.inGroup) {
            embed.addFields({ name: 'Group Rank', value: rankInfo.roleName, inline: true });
        }

        embed.addFields({ 
            name: 'Verified Since', 
            value: `<t:${Math.floor(new Date(status.verifiedAt).getTime() / 1000)}:R>`, 
            inline: true 
        });

        embed.setFooter({ text: `Roblox Profile: roblox.com/users/${status.robloxId}` });

        await interaction.editReply({ embeds: [embed] });
    },
};
