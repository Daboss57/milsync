/**
 * REST API Server for In-Game Integration
 * Allows Roblox games to interact with the bot via HTTP requests
 */

const express = require('express');
const helmet = require('helmet');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const crypto = require('crypto');
const logger = require('../utils/logger');
const config = require('../config');

const LinkedAccountsRepository = require('../database/repositories/linkedAccounts');
const RankService = require('../services/rankService');
const robloxService = require('../services/robloxService');
const { getDatabase } = require('../database/init');

let discordClient = null;

// Rate limiter
const rateLimiter = new RateLimiterMemory({
    points: 60, // requests
    duration: 60, // per minute
});

/**
 * Start the API server
 */
async function startApiServer(client) {
    discordClient = client;
    const app = express();

    // Security middleware
    app.use(helmet());
    app.use(express.json());

    // API key authentication middleware
    app.use('/api', authenticateApiKey);

    // Rate limiting middleware
    app.use('/api', async (req, res, next) => {
        try {
            await rateLimiter.consume(req.ip);
            next();
        } catch (e) {
            res.status(429).json({ error: 'Too many requests' });
        }
    });

    // Routes
    app.get('/health', (req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Get user info by Roblox ID
    app.get('/api/user/:robloxId', async (req, res) => {
        try {
            const { robloxId } = req.params;
            const linked = LinkedAccountsRepository.getByRobloxId(robloxId);
            
            if (!linked) {
                return res.status(404).json({ error: 'User not found', verified: false });
            }

            res.json({
                verified: true,
                discordId: linked.discord_id,
                robloxId: linked.roblox_id,
                robloxUsername: linked.roblox_username,
            });
        } catch (error) {
            logger.error('API error (get user):', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Get user's rank in group
    app.get('/api/user/:robloxId/rank', async (req, res) => {
        try {
            const { robloxId } = req.params;
            const { groupId } = req.query;
            
            const targetGroupId = groupId || config.roblox.defaultGroupId;
            if (!targetGroupId) {
                return res.status(400).json({ error: 'No group ID specified' });
            }

            const rankInfo = await robloxService.getUserGroupRank(robloxId, targetGroupId);
            
            if (!rankInfo) {
                return res.status(500).json({ error: 'Failed to fetch rank' });
            }

            res.json({
                robloxId,
                groupId: targetGroupId,
                inGroup: rankInfo.inGroup,
                rank: rankInfo.rank,
                rankName: rankInfo.roleName,
            });
        } catch (error) {
            logger.error('API error (get rank):', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Promote user
    app.post('/api/promote', async (req, res) => {
        try {
            const { robloxId, groupId } = req.body;
            
            if (!robloxId) {
                return res.status(400).json({ error: 'robloxId is required' });
            }

            const linked = LinkedAccountsRepository.getByRobloxId(robloxId);
            if (!linked) {
                return res.status(404).json({ error: 'User not verified' });
            }

            const targetGroupId = groupId || config.roblox.defaultGroupId;
            const result = await RankService.promote(
                req.guildId || 'api',
                linked.discord_id,
                'api',
                targetGroupId
            );

            if (result.success) {
                res.json({
                    success: true,
                    robloxUsername: result.robloxUsername,
                    oldRank: result.oldRank,
                    newRank: result.newRank,
                });
            } else {
                res.status(400).json({ success: false, error: result.message });
            }
        } catch (error) {
            logger.error('API error (promote):', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Demote user
    app.post('/api/demote', async (req, res) => {
        try {
            const { robloxId, groupId } = req.body;
            
            if (!robloxId) {
                return res.status(400).json({ error: 'robloxId is required' });
            }

            const linked = LinkedAccountsRepository.getByRobloxId(robloxId);
            if (!linked) {
                return res.status(404).json({ error: 'User not verified' });
            }

            const targetGroupId = groupId || config.roblox.defaultGroupId;
            const result = await RankService.demote(
                req.guildId || 'api',
                linked.discord_id,
                'api',
                targetGroupId
            );

            if (result.success) {
                res.json({
                    success: true,
                    robloxUsername: result.robloxUsername,
                    oldRank: result.oldRank,
                    newRank: result.newRank,
                });
            } else {
                res.status(400).json({ success: false, error: result.message });
            }
        } catch (error) {
            logger.error('API error (demote):', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Set rank
    app.post('/api/setrank', async (req, res) => {
        try {
            const { robloxId, rank, groupId } = req.body;
            
            if (!robloxId || rank === undefined) {
                return res.status(400).json({ error: 'robloxId and rank are required' });
            }

            const linked = LinkedAccountsRepository.getByRobloxId(robloxId);
            if (!linked) {
                return res.status(404).json({ error: 'User not verified' });
            }

            const targetGroupId = groupId || config.roblox.defaultGroupId;
            const result = await RankService.setRank(
                req.guildId || 'api',
                linked.discord_id,
                'api',
                rank,
                targetGroupId
            );

            if (result.success) {
                res.json({
                    success: true,
                    robloxUsername: result.robloxUsername,
                    oldRank: result.oldRank,
                    newRank: result.newRank,
                });
            } else {
                res.status(400).json({ success: false, error: result.message });
            }
        } catch (error) {
            logger.error('API error (setrank):', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Verify user is linked
    app.get('/api/verify/:robloxId', async (req, res) => {
        try {
            const { robloxId } = req.params;
            const linked = LinkedAccountsRepository.getByRobloxId(robloxId);
            
            res.json({
                verified: !!linked,
                discordId: linked?.discord_id || null,
            });
        } catch (error) {
            logger.error('API error (verify):', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Start server
    const port = config.api.port;
    app.listen(port, () => {
        logger.info(`API server listening on port ${port}`);
    });
}

/**
 * Authenticate API key from request
 */
function authenticateApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    
    if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
    }

    // Check against master key
    if (apiKey === config.api.secretKey) {
        return next();
    }

    // Check against stored API keys
    const db = getDatabase();
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const storedKey = db.prepare('SELECT * FROM api_keys WHERE key_hash = ?').get(keyHash);

    if (!storedKey) {
        return res.status(401).json({ error: 'Invalid API key' });
    }

    // Update last used timestamp
    db.prepare('UPDATE api_keys SET last_used = CURRENT_TIMESTAMP WHERE id = ?').run(storedKey.id);

    req.guildId = storedKey.guild_id;
    next();
}

module.exports = { startApiServer };
