/**
 * Scheduled Tasks Service
 */

const cron = require('node-cron');
const logger = require('../utils/logger');
const VerificationService = require('./verificationService');
const XPService = require('./xpService');
const BlacklistRepository = require('../database/repositories/blacklist');
const RoleSyncService = require('./roleSyncService');
const OAuthStateRepository = require('../database/repositories/oauthState');

/**
 * Start all scheduled tasks
 */
function startScheduledTasks(client) {
    // Clean up expired verifications & OAuth states every 5 minutes
    cron.schedule('*/5 * * * *', () => {
        logger.debug('Running: cleanup expired verifications & OAuth states');
        VerificationService.cleanupExpired();
        OAuthStateRepository.cleanupExpired();
    });

    // Clean up XP cooldowns every 10 minutes
    cron.schedule('*/10 * * * *', () => {
        logger.debug('Running: cleanup XP cooldowns');
        XPService.cleanupCooldowns();
    });

    // Purge expired blacklist entries daily at midnight
    cron.schedule('0 0 * * *', () => {
        logger.info('Running: purge expired blacklist entries');
        BlacklistRepository.purgeExpired();
    });

    // Auto-sync all guilds every 6 hours (optional, can be resource intensive)
    cron.schedule('0 */6 * * *', async () => {
        logger.info('Running: scheduled auto-sync for all guilds');

        for (const [guildId, guild] of client.guilds.cache) {
            try {
                // Only sync if auto-sync is enabled for this guild
                const { getDatabase } = require('../database/init');
                const db = getDatabase();
                const config = db.prepare('SELECT auto_sync_enabled FROM guild_configs WHERE guild_id = ?').get(guildId);

                if (config?.auto_sync_enabled) {
                    await RoleSyncService.syncGuild(guild);
                    logger.info(`Auto-synced guild: ${guild.name}`);
                }
            } catch (error) {
                logger.error(`Auto-sync failed for guild ${guildId}: ${error.message}`);
            }
        }
    });

    logger.info('Scheduled tasks started');
}

module.exports = { startScheduledTasks };
