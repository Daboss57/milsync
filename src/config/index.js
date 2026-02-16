/**
 * Centralized configuration management
 */

const path = require('path');

const config = {
    // Discord settings
    discord: {
        token: process.env.DISCORD_TOKEN,
        clientId: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
    },

    // Roblox settings
    roblox: {
        apiKey: process.env.ROBLOX_API_KEY,
        defaultGroupId: process.env.ROBLOX_GROUP_ID,
        openCloudBaseUrl: 'https://apis.roblox.com',
        usersApiUrl: 'https://users.roblox.com',
        groupsApiUrl: 'https://groups.roblox.com',
    },

    // Roblox OAuth2 settings (for one-click verification)
    robloxOAuth: {
        clientId: process.env.ROBLOX_OAUTH_CLIENT_ID,
        clientSecret: process.env.ROBLOX_OAUTH_CLIENT_SECRET,
        redirectUri: process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/oauth/callback',
        authorizeUrl: 'https://apis.roblox.com/oauth/v1/authorize',
        tokenUrl: 'https://apis.roblox.com/oauth/v1/token',
        userinfoUrl: 'https://apis.roblox.com/oauth/v1/userinfo',
    },

    // Database settings
    database: {
        path: process.env.DATABASE_PATH || path.join(__dirname, '../../data/rpcommand.db'),
    },

    // API server settings
    api: {
        port: parseInt(process.env.API_PORT) || 3000,
        secretKey: process.env.API_SECRET_KEY,
    },

    // Logging settings
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        channelId: process.env.LOG_CHANNEL_ID,
    },

    // Feature toggles
    features: {
        enableXpSystem: process.env.ENABLE_XP_SYSTEM === 'true',
        enableApplications: process.env.ENABLE_APPLICATIONS === 'true',
        enableIngameApi: process.env.ENABLE_INGAME_API === 'true',
        enableAutoSync: process.env.ENABLE_AUTO_SYNC === 'true',
        enableOAuth: !!(process.env.ROBLOX_OAUTH_CLIENT_ID && process.env.ROBLOX_OAUTH_CLIENT_SECRET),
    },

    // Rate limiting
    rateLimits: {
        commandCooldown: parseInt(process.env.COMMAND_COOLDOWN_SECONDS) || 5,
        syncCooldown: parseInt(process.env.SYNC_COOLDOWN_SECONDS) || 300,
    },

    // Verification settings
    verification: {
        timeoutMinutes: parseInt(process.env.VERIFICATION_TIMEOUT_MINUTES) || 10,
        codeLength: 8,
    },

    // XP System defaults
    xp: {
        messageXp: 5,
        voiceXpPerMinute: 2,
        eventAttendanceXp: 50,
        dailyBonus: 25,
    },

    // Colors for embeds
    colors: {
        primary: 0x5865F2,    // Discord blurple
        success: 0x57F287,    // Green
        warning: 0xFEE75C,    // Yellow
        error: 0xED4245,      // Red
        info: 0x5865F2,       // Blue
    },
};

// Validate required configuration
function validateConfig() {
    const required = [
        ['DISCORD_TOKEN', config.discord.token],
        ['ROBLOX_API_KEY', config.roblox.apiKey],
    ];

    const missing = required.filter(([name, value]) => !value);

    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables: ${missing.map(([name]) => name).join(', ')}\n` +
            'Please check your .env file and ensure all required values are set.'
        );
    }
}

// Only validate in production (skip in test mode or when checking database only)
if (process.env.NODE_ENV === 'production') {
    validateConfig();
}

module.exports = config;
