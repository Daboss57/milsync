# RPCommand Center

The ultimate Roblox RP management suite for Discord - a comprehensive, self-hosted bot for managing Roblox groups, syncing ranks with Discord roles, handling verifications, and adding RP-specific features.

## 🌟 Features

### Core Features
- **Account Verification** - Link Roblox accounts to Discord via bio verification
- **Role Syncing** - Automatically sync Discord roles with Roblox group ranks
- **Rank Management** - Promote, demote, and set ranks directly from Discord
- **Bindings System** - Flexible mapping between Roblox ranks and Discord roles

### Advanced Features
- **XP/Points System** - Track user activity and auto-promote based on XP
- **Applications** - In-Discord application system with approval workflow
- **Audit Logging** - Complete logging of all actions for accountability
- **In-Game API** - REST API for Roblox game integration
- **Blacklist System** - Ban management with expiration support
- **Multi-Group Support** - Manage multiple Roblox groups per server

## 📋 Requirements

- Node.js 18.0.0 or higher
- Discord Bot Token
- Roblox Open Cloud API Key

## 🚀 Quick Start

### 1. Clone and Install

```bash
cd milsync
npm install
```

### 2. Configure

Run the setup wizard:
```bash
npm run setup
```

Or manually copy `.env.example` to `.env` and fill in your credentials:
```env
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_client_id
ROBLOX_API_KEY=your_roblox_api_key
ROBLOX_GROUP_ID=your_group_id
```

### 3. Start the Bot

```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## 🤖 Bot Commands

### Verification
| Command | Description |
|---------|-------------|
| `/verify <username>` | Link your Roblox account |
| `/unlink` | Remove account link |
| `/whois [user]` | View Roblox info for a user |

### Rank Management
| Command | Description |
|---------|-------------|
| `/promote <user>` | Promote to next rank |
| `/demote <user>` | Demote to previous rank |
| `/setrank <user> <rank>` | Set specific rank |
| `/rankinfo [user]` | View rank information |

### Role Syncing
| Command | Description |
|---------|-------------|
| `/update` | Sync your Discord roles |
| `/syncall` | Sync all members (Admin) |

### Bindings
| Command | Description |
|---------|-------------|
| `/bind <rank> <role>` | Create rank-role binding |
| `/unbind <rank>` | Remove binding |
| `/bindings` | View all bindings |
| `/ranks` | View group ranks |

### XP System
| Command | Description |
|---------|-------------|
| `/xp [user]` | View XP and level |
| `/leaderboard` | View server leaderboard |
| `/givexp <user> <amount>` | Award XP (Admin) |

### Applications
| Command | Description |
|---------|-------------|
| `/apply <type> <position> <reason>` | Submit application |
| `/applications mine` | View your applications |
| `/applications pending` | View pending (Staff) |

### Admin
| Command | Description |
|---------|-------------|
| `/config` | Configure bot settings |
| `/logs` | View audit logs |
| `/blacklist` | Manage blacklist |
| `/stats` | View server statistics |
| `/help` | View all commands |

## 🎮 In-Game Integration

The bot provides a REST API for Roblox game integration. See `/roblox/RPCommandAPI.lua` for the client module.

### API Endpoints

```
GET  /api/user/:robloxId         - Get user verification status
GET  /api/user/:robloxId/rank    - Get user's group rank
POST /api/promote                 - Promote a user
POST /api/demote                  - Demote a user
POST /api/setrank                 - Set user to specific rank
GET  /api/verify/:robloxId       - Check if user is verified
```

### Example Roblox Usage

```lua
local RPCommandAPI = require(game.ServerScriptService.RPCommandAPI)
RPCommandAPI.Config.BaseURL = "http://your-server:3000/api"
RPCommandAPI.Config.APIKey = "your-api-key"

local verified, discordId = RPCommandAPI:IsVerified(player)
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DISCORD_TOKEN` | Discord bot token | Required |
| `DISCORD_CLIENT_ID` | Discord application ID | Required |
| `ROBLOX_API_KEY` | Roblox Open Cloud API key | Required |
| `ROBLOX_GROUP_ID` | Default Roblox group ID | Required |
| `DATABASE_PATH` | SQLite database location | `./data/rpcommand.db` |
| `API_PORT` | In-game API server port | `3000` |
| `API_SECRET_KEY` | API authentication key | Required for API |
| `ENABLE_XP_SYSTEM` | Enable XP tracking | `true` |
| `ENABLE_APPLICATIONS` | Enable applications | `true` |
| `ENABLE_INGAME_API` | Enable REST API | `true` |
| `ENABLE_AUTO_SYNC` | Enable scheduled sync | `true` |

### Roblox API Key Scopes

Your Roblox Open Cloud API key needs these scopes:
- `group.membership:read` - Read group memberships
- `group.membership:write` - Modify ranks
- `user:read` - Read user profiles

## 📁 Project Structure

```
rpcommand-center/
├── src/
│   ├── commands/          # Slash commands by category
│   │   ├── admin/
│   │   ├── applications/
│   │   ├── bindings/
│   │   ├── general/
│   │   ├── ranks/
│   │   ├── sync/
│   │   ├── verification/
│   │   └── xp/
│   ├── config/            # Configuration management
│   ├── database/          # Database init and repositories
│   │   └── repositories/
│   ├── events/            # Discord event handlers
│   ├── handlers/          # Command and event loaders
│   ├── services/          # Business logic services
│   ├── api/               # REST API server
│   └── utils/             # Utility functions
├── roblox/                # Roblox Lua integration scripts
├── scripts/               # Setup and utility scripts
├── data/                  # Database files
└── logs/                  # Log files
```

## 🛡️ Security

- No Roblox cookies required - uses official Open Cloud API
- API keys stored securely with encryption
- Rate limiting on all commands and API endpoints
- Audit logging for all administrative actions
- HTTPS recommended for API server in production

## 📝 License

MIT License - feel free to modify and self-host!

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## 📞 Support

- Create an issue for bug reports
- Start a discussion for feature requests
