/**
 * WhoIs Command - Look up a user's Roblox info, rank, XP, and activity
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const LinkedAccountsRepository = require('../../database/repositories/linkedAccounts');
const XPRepository = require('../../database/repositories/xp');
const robloxService = require('../../services/robloxService');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whois')
        .setDescription('Look up a user\'s Roblox account, rank, and stats')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The Discord user to look up')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('user');
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        // Check verification
        const linked = LinkedAccountsRepository.getByDiscordId(targetUser.id);

        const embed = new EmbedBuilder()
            .setColor(linked ? config.colors.success : config.colors.warning)
            .setTitle(`🔍 Who Is ${targetUser.displayName}?`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
            .setTimestamp();

        // Discord info
        const discordInfo = [
            `**Username:** ${targetUser.tag}`,
            `**ID:** ${targetUser.id}`,
        ];
        if (member) {
            discordInfo.push(`**Joined Server:** <t:${Math.floor(member.joinedTimestamp / 1000)}:R>`);
            discordInfo.push(`**Account Created:** <t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`);
        }
        embed.addFields({ name: '💬 Discord', value: discordInfo.join('\n'), inline: false });

        // Roblox info
        if (linked) {
            const robloxInfo = [
                `**Username:** [${linked.roblox_username}](https://www.roblox.com/users/${linked.roblox_id}/profile)`,
                `**Roblox ID:** ${linked.roblox_id}`,
                `**Verified:** <t:${Math.floor(new Date(linked.verified_at).getTime() / 1000)}:R>`,
            ];

            // Get group rank
            const groupId = config.roblox.groupId;
            if (groupId) {
                const rankInfo = await robloxService.getUserGroupRank(linked.roblox_id, groupId);
                if (rankInfo && rankInfo.inGroup) {
                    robloxInfo.push(`**Group Rank:** ${rankInfo.roleName} (${rankInfo.rank})`);
                } else if (rankInfo && !rankInfo.inGroup) {
                    robloxInfo.push('**Group Rank:** Not in group');
                }
            }

            // Try to get Roblox avatar for thumbnail
            try {
                const avatarUrl = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${linked.roblox_id}&size=150x150&format=Png`;
                const response = await fetch(avatarUrl);
                if (response.ok) {
                    const data = await response.json();
                    const imageUrl = data.data?.[0]?.imageUrl;
                    if (imageUrl) {
                        embed.setThumbnail(imageUrl);
                    }
                }
            } catch {
                // Keep Discord avatar as fallback
            }

            embed.addFields({ name: '🎮 Roblox', value: robloxInfo.join('\n'), inline: false });
        } else {
            embed.addFields({ name: '🎮 Roblox', value: '⚠️ Not verified', inline: false });
        }

        // XP info
        const xpRecord = XPRepository.get(interaction.guildId, targetUser.id);
        if (xpRecord) {
            const xpForNext = XPRepository.xpForLevel(xpRecord.level + 1);
            const xpInfo = [
                `**Level:** ${xpRecord.level}`,
                `**XP:** ${xpRecord.xp} / ${xpForNext}`,
                `**Messages:** ${xpRecord.total_messages}`,
                `**Voice Time:** ${xpRecord.voice_minutes} min`,
            ];
            embed.addFields({ name: '⭐ Stats', value: xpInfo.join('\n'), inline: false });
        }

        // Activity info
        try {
            const ActivityRepository = require('../../database/repositories/activity');
            const activity = ActivityRepository.getActivity(interaction.guildId, targetUser.id);
            if (activity) {
                const actInfo = [];
                if (activity.last_message_at) {
                    actInfo.push(`**Last Message:** <t:${Math.floor(new Date(activity.last_message_at).getTime() / 1000)}:R>`);
                }
                if (activity.last_voice_at) {
                    actInfo.push(`**Last Voice:** <t:${Math.floor(new Date(activity.last_voice_at).getTime() / 1000)}:R>`);
                }
                if (actInfo.length > 0) {
                    embed.addFields({ name: '📊 Activity', value: actInfo.join('\n'), inline: false });
                }
            }
        } catch {
            // Activity tracker not yet available, skip
        }

        // Roles
        if (member) {
            const roles = member.roles.cache
                .filter(r => r.id !== interaction.guildId)
                .sort((a, b) => b.position - a.position)
                .map(r => `${r}`)
                .slice(0, 15);
            if (roles.length > 0) {
                embed.addFields({
                    name: `🏷️ Roles (${member.roles.cache.size - 1})`,
                    value: roles.join(', ').slice(0, 1024),
                    inline: false,
                });
            }
        }

        await interaction.editReply({ embeds: [embed] });
    },
};
