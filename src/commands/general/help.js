/**
 * Help Command - Display bot commands and information
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('View available commands and bot information')
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Command category to view')
                .setRequired(false)
                .addChoices(
                    { name: 'Verification', value: 'verification' },
                    { name: 'Ranks', value: 'ranks' },
                    { name: 'Bindings', value: 'bindings' },
                    { name: 'XP System', value: 'xp' },
                    { name: 'Applications', value: 'applications' },
                    { name: 'Admin', value: 'admin' }
                )
        ),

    async execute(interaction) {
        const category = interaction.options.getString('category');

        if (category) {
            await sendCategoryHelp(interaction, category);
        } else {
            await sendOverview(interaction);
        }
    },
};

async function sendOverview(interaction) {
    const embed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle('🎮 RPCommand Center')
        .setDescription(
            'The ultimate Roblox RP management suite for Discord. ' +
            'Seamlessly sync Roblox ranks with Discord roles, manage promotions, ' +
            'track XP, and more!\n\n' +
            'Use `/help <category>` to see commands in each category.'
        )
        .addFields(
            { 
                name: '🔐 Verification', 
                value: '`/verify` `/unlink` `/whois`', 
                inline: true 
            },
            { 
                name: '🔄 Role Sync', 
                value: '`/update` `/syncall`', 
                inline: true 
            },
            { 
                name: '🎖️ Rank Management', 
                value: '`/promote` `/demote` `/setrank` `/rankinfo`', 
                inline: true 
            },
            { 
                name: '🔗 Bindings', 
                value: '`/bind` `/unbind` `/bindings` `/ranks`', 
                inline: true 
            },
            { 
                name: '⭐ XP System', 
                value: '`/xp` `/leaderboard` `/givexp`', 
                inline: true 
            },
            { 
                name: '📋 Applications', 
                value: '`/apply` `/applications`', 
                inline: true 
            },
            { 
                name: '⚙️ Admin', 
                value: '`/config` `/logs` `/blacklist` `/stats`', 
                inline: true 
            }
        )
        .setFooter({ text: 'RPCommand Center v1.0.0' });

    await interaction.reply({ embeds: [embed] });
}

async function sendCategoryHelp(interaction, category) {
    const categories = {
        verification: {
            title: '🔐 Verification Commands',
            commands: [
                { name: '/verify <username>', desc: 'Link your Roblox account to Discord' },
                { name: '/unlink', desc: 'Remove your Roblox account link' },
                { name: '/whois [user]', desc: 'View Roblox info for a user' },
            ],
        },
        ranks: {
            title: '🎖️ Rank Management Commands',
            commands: [
                { name: '/promote <user>', desc: 'Promote a user to the next rank' },
                { name: '/demote <user>', desc: 'Demote a user to the previous rank' },
                { name: '/setrank <user> <rank>', desc: 'Set a user to a specific rank' },
                { name: '/rankinfo [user]', desc: 'View current rank information' },
                { name: '/update', desc: 'Sync your Discord roles with Roblox' },
                { name: '/syncall', desc: 'Sync roles for all verified members (Admin)' },
            ],
        },
        bindings: {
            title: '🔗 Binding Commands',
            commands: [
                { name: '/bind <rank> <role>', desc: 'Create a rank-to-role binding' },
                { name: '/unbind <rank>', desc: 'Remove a rank binding' },
                { name: '/bindings', desc: 'View all configured bindings' },
                { name: '/ranks', desc: 'View all ranks in the Roblox group' },
            ],
        },
        xp: {
            title: '⭐ XP System Commands',
            commands: [
                { name: '/xp [user]', desc: 'View XP and level information' },
                { name: '/leaderboard [page]', desc: 'View the server XP leaderboard' },
                { name: '/givexp <user> <amount>', desc: 'Award XP to a user (Admin)' },
            ],
        },
        applications: {
            title: '📋 Application Commands',
            commands: [
                { name: '/apply <type> <position> <reason>', desc: 'Submit an application' },
                { name: '/applications mine', desc: 'View your applications' },
                { name: '/applications pending', desc: 'View pending applications (Staff)' },
                { name: '/applications stats', desc: 'View application statistics' },
            ],
        },
        admin: {
            title: '⚙️ Admin Commands',
            commands: [
                { name: '/config view', desc: 'View current server configuration' },
                { name: '/config logchannel <channel>', desc: 'Set the audit log channel' },
                { name: '/config autosync <enabled>', desc: 'Toggle automatic role syncing' },
                { name: '/logs [type] [user]', desc: 'View audit logs' },
                { name: '/blacklist add/remove/list/check', desc: 'Manage blacklisted users' },
                { name: '/stats', desc: 'View server statistics' },
            ],
        },
    };

    const cat = categories[category];
    
    const embed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle(cat.title)
        .setDescription(cat.commands.map(c => `**${c.name}**\n${c.desc}`).join('\n\n'));

    await interaction.reply({ embeds: [embed] });
}
