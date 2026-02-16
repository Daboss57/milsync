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

    // Privacy Policy page (required by Roblox OAuth)
    app.get('/privacy', (req, res) => {
        res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>MilSync - Privacy Policy</title>
<style>body{font-family:'Segoe UI',sans-serif;background:#1a1a2e;color:#ddd;max-width:700px;margin:40px auto;padding:20px;line-height:1.7}h1{color:#5865F2}h2{color:#a0a0c0;margin-top:28px}a{color:#5865F2}</style>
</head><body>
<h1>MilSync Privacy Policy</h1>
<p><em>Last updated: ${new Date().toLocaleDateString()}</em></p>
<h2>What We Collect</h2>
<p>When you verify through MilSync, we store your <strong>Discord user ID</strong> and <strong>Roblox user ID/username</strong> to link your accounts. We do not store passwords, tokens, or any other personal information.</p>
<h2>How We Use It</h2>
<p>Your linked account data is used solely to sync your Discord roles with your Roblox group ranks. We do not sell, share, or use your data for any other purpose.</p>
<h2>Data Retention</h2>
<p>Your data is stored as long as your account is linked. You can remove it at any time by using the <code>/unlink</code> command in Discord.</p>
<h2>Third-Party Services</h2>
<p>MilSync interacts with the <a href="https://roblox.com">Roblox API</a> and <a href="https://discord.com">Discord API</a> to provide its functionality.</p>
<h2>Contact</h2>
<p>For questions, contact the bot administrator in your Discord server.</p>
</body></html>`);
    });

    // Terms of Service page (required by Roblox OAuth)
    app.get('/terms', (req, res) => {
        res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>MilSync - Terms of Service</title>
<style>body{font-family:'Segoe UI',sans-serif;background:#1a1a2e;color:#ddd;max-width:700px;margin:40px auto;padding:20px;line-height:1.7}h1{color:#5865F2}h2{color:#a0a0c0;margin-top:28px}</style>
</head><body>
<h1>MilSync Terms of Service</h1>
<p><em>Last updated: ${new Date().toLocaleDateString()}</em></p>
<h2>Acceptance</h2>
<p>By using MilSync, you agree to these terms. If you do not agree, do not use the bot.</p>
<h2>Service Description</h2>
<p>MilSync is a Discord bot that links Discord accounts with Roblox accounts and syncs group roles. The service is provided as-is.</p>
<h2>User Responsibilities</h2>
<p>You must only link accounts that you own. Attempting to link someone else's account is prohibited and may result in a ban.</p>
<h2>Termination</h2>
<p>Server administrators may remove your access at any time. You can unlink your account using <code>/unlink</code>.</p>
<h2>Limitation of Liability</h2>
<p>MilSync is provided without warranty. We are not liable for any issues arising from the use of this bot.</p>
</body></html>`);
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

    // ── OAuth2 Callback Route (public — no API key) ──
    if (config.features.enableOAuth) {
        const OAuthService = require('../services/oauthService');
        const RoleSyncService = require('../services/roleSyncService');

        app.get('/oauth/callback', async (req, res) => {
            const { code, state, error: oauthError } = req.query;

            if (oauthError) {
                logger.warn(`OAuth error from Roblox: ${oauthError}`);
                return res.status(400).send(renderOAuthPage(false, 'Authorization was denied or an error occurred.'));
            }

            if (!code || !state) {
                return res.status(400).send(renderOAuthPage(false, 'Missing authorization code or state.'));
            }

            try {
                const result = await OAuthService.handleCallback(code, state);

                if (!result.success) {
                    return res.send(renderOAuthPage(false, result.message));
                }

                // Try to sync roles in the guild
                try {
                    const guild = await discordClient.guilds.fetch(result.guildId);
                    const member = await guild.members.fetch(result.discordId);
                    await RoleSyncService.syncMember(member, result.guildId);
                    logger.info(`Auto-synced roles for ${result.discordId} after OAuth verification`);
                } catch (syncError) {
                    logger.warn(`Could not auto-sync roles after OAuth verify: ${syncError.message}`);
                }

                // Try to DM the user
                try {
                    const user = await discordClient.users.fetch(result.discordId);
                    await user.send({
                        embeds: [{
                            title: '✅ Verification Complete!',
                            description: `You are now verified as **${result.robloxUser.name}** (${result.robloxUser.displayName}).`,
                            color: 0x00d166,
                            timestamp: new Date().toISOString(),
                        }],
                    });
                } catch (dmError) {
                    logger.debug(`Could not DM user ${result.discordId}: ${dmError.message}`);
                }

                return res.send(renderOAuthPage(true, `You are now verified as ${result.robloxUser.name}!`));
            } catch (error) {
                logger.error('OAuth callback error:', error);
                return res.status(500).send(renderOAuthPage(false, 'An unexpected error occurred.'));
            }
        });
    }

    // Start server
    const port = config.api.port;
    app.listen(port, () => {
        logger.info(`API server listening on port ${port}`);
    });
}

/**
 * Render a simple HTML page for OAuth result
 */
function renderOAuthPage(success, message) {
    const emoji = success ? '✅' : '❌';
    const color = success ? '#00d166' : '#ed4245';
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>MilSync Verification</title>
    <style>
        body { font-family: 'Segoe UI', sans-serif; background: #1a1a2e; color: #eee; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
        .card { background: #16213e; border-radius: 12px; padding: 40px; text-align: center; max-width: 420px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
        .emoji { font-size: 48px; margin-bottom: 16px; }
        h1 { color: ${color}; margin: 0 0 12px; font-size: 24px; }
        p { color: #a0a0b0; line-height: 1.6; }
        .close { margin-top: 20px; color: #666; font-size: 13px; }
    </style>
</head>
<body>
    <div class="card">
        <div class="emoji">${emoji}</div>
        <h1>${success ? 'Verification Complete' : 'Verification Failed'}</h1>
        <p>${message}</p>
        <p class="close">You can close this tab and return to Discord.</p>
    </div>
</body>
</html>`;
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
