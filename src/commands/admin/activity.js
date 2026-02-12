/**
 * Activity Command - Check user activity or list inactive members
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const ActivityRepository = require('../../database/repositories/activity');
const LinkedAccountsRepository = require('../../database/repositories/linkedAccounts');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('activity')
        .setDescription('Check member activity')
        .addSubcommand(sub =>
            sub.setName('check')
                .setDescription('Check a specific user\'s activity')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to check')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('inactive')
                .setDescription('List inactive verified members')
                .addIntegerOption(option =>
                    option.setName('days')
                        .setDescription('Days of inactivity (default: 14)')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(365)
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        await interaction.deferReply();

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'check') {
            await this.handleCheck(interaction);
        } else if (subcommand === 'inactive') {
            await this.handleInactive(interaction);
        }
    },

    async handleCheck(interaction) {
        const targetUser = interaction.options.getUser('user');
        const activity = ActivityRepository.getActivity(interaction.guildId, targetUser.id);

        const embed = new EmbedBuilder()
            .setColor(config.colors.primary)
            .setTitle(`📊 Activity — ${targetUser.displayName}`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 128 }))
            .setTimestamp();

        if (!activity) {
            embed.setDescription('No activity recorded for this user yet.');
        } else {
            const fields = [];

            if (activity.last_message_at) {
                const ts = Math.floor(new Date(activity.last_message_at).getTime() / 1000);
                fields.push({ name: '💬 Last Message', value: `<t:${ts}:f> (<t:${ts}:R>)`, inline: true });
            } else {
                fields.push({ name: '💬 Last Message', value: 'Never', inline: true });
            }

            if (activity.last_voice_at) {
                const ts = Math.floor(new Date(activity.last_voice_at).getTime() / 1000);
                fields.push({ name: '🔊 Last Voice', value: `<t:${ts}:f> (<t:${ts}:R>)`, inline: true });
            } else {
                fields.push({ name: '🔊 Last Voice', value: 'Never', inline: true });
            }

            if (activity.last_active_at) {
                const ts = Math.floor(new Date(activity.last_active_at).getTime() / 1000);
                fields.push({ name: '⏰ Last Active', value: `<t:${ts}:f> (<t:${ts}:R>)`, inline: false });
            }

            embed.addFields(fields);

            // Calculate days since last active
            if (activity.last_active_at) {
                const daysSince = Math.floor((Date.now() - new Date(activity.last_active_at).getTime()) / (1000 * 60 * 60 * 24));
                if (daysSince >= 14) {
                    embed.setColor(config.colors.error);
                    embed.setFooter({ text: `⚠️ Inactive for ${daysSince} days` });
                } else if (daysSince >= 7) {
                    embed.setColor(config.colors.warning);
                    embed.setFooter({ text: `⚠️ Low activity — ${daysSince} days since last seen` });
                } else {
                    embed.setColor(config.colors.success);
                    embed.setFooter({ text: `Active within the last ${daysSince === 0 ? 'day' : daysSince + ' days'}` });
                }
            }
        }

        // Check verification status
        const linked = LinkedAccountsRepository.getByDiscordId(targetUser.id);
        if (linked) {
            embed.addFields({
                name: '🎮 Roblox Account',
                value: `[${linked.roblox_username}](https://www.roblox.com/users/${linked.roblox_id}/profile)`,
                inline: true,
            });
        } else {
            embed.addFields({ name: '🎮 Roblox Account', value: 'Not verified', inline: true });
        }

        await interaction.editReply({ embeds: [embed] });
    },

    async handleInactive(interaction) {
        const days = interaction.options.getInteger('days') || 14;
        const inactiveMembers = ActivityRepository.getInactive(interaction.guildId, days);

        const embed = new EmbedBuilder()
            .setColor(inactiveMembers.length > 0 ? config.colors.warning : config.colors.success)
            .setTitle(`📋 Inactive Members (${days}+ days)`)
            .setTimestamp();

        if (inactiveMembers.length === 0) {
            embed.setDescription('🎉 No inactive verified members found!');
        } else {
            // Build list, max 20 to avoid embed limits
            const list = inactiveMembers.slice(0, 20).map((m, i) => {
                const lastSeen = m.last_active_at
                    ? `<t:${Math.floor(new Date(m.last_active_at).getTime() / 1000)}:R>`
                    : 'Never';
                return `**${i + 1}.** <@${m.discord_id}> — ${m.roblox_username || 'Unknown'} — Last seen: ${lastSeen}`;
            });

            embed.setDescription(list.join('\n'));

            if (inactiveMembers.length > 20) {
                embed.setFooter({ text: `Showing 20 of ${inactiveMembers.length} inactive members` });
            } else {
                embed.setFooter({ text: `${inactiveMembers.length} inactive member${inactiveMembers.length === 1 ? '' : 's'}` });
            }
        }

        await interaction.editReply({ embeds: [embed] });
    },
};
