# 🛡️ ishow — Antinuke & Multipurpose Discord Bot

**ishow** is a next-generation Discord protection and multipurpose bot built with **Node.js** and **discord.js v14**. It features an enterprise-grade **Rolling-Limit Antinuke Engine**, **Pre-execution Hierarchy Safety Checker**, **Bulk-ban Floor Role Mitigation**, **Automod**, **Dual-Channel Audit Logging**, **Support Ticketing with HTML Transcripts**, **Persistent Giveaways**, **Reaction & Vanity Roles**, **Welcomer**, **Music Streaming**, and **Fun/Utility** tools.

---

## 🚀 Key Systems Overview

### 1. 🛡️ Core Antinuke Rolling-Limit Engine
- **Per-action Rolling Rate Limits:** Tracks actions per user in a configurable sliding time window. Crossing the threshold immediately intercepts the attack and punishes the executor.
- **Dangerous Event Categories Covered:**
  - `ban`, `unban`, `kick`, `member_prune`, `bot_add`, `vanity_change`
  - `channel_create`, `channel_delete`, `channel_update`
  - `role_create`, `role_delete`, `role_update`, `member_update`
  - `server_update`, `mass_mention`, `emoji_sticker_create`, `emoji_sticker_delete`, `emoji_sticker_update`
  - `webhook_create`, `webhook_delete`, `webhook_update`, `integration_add`, `invite_role_grant`
- **Configurable Punishments:** `ban`, `kick`, `strip_roles`, `quarantine` (28-day timeout).
- **Pre-execution Safety Check:** Verifies executor role position, bot role hierarchy, and Discord permissions before executing any punishment to ensure the bot can never be tricked.
- **Trust System:**
  - **Server Owner:** Permanently immune and root authority.
  - **Extra Owners:** Delegated co-admins authorized to configure security settings.
  - **Whitelist:** Exempt from all rate limits while retaining normal permissions.
- **Bulk-ban Floor Role Defense (`/antinuke floor-role setup`):** Automatically creates a permissionless `ishow-security-floor` role positioned right below the bot. Placing elevated staff roles below this floor ensures compromised admins cannot bulk-ban or wipe members.

---

## 📋 Slash Commands Reference

### 🛡️ Security & Antinuke (`/antinuke`)
| Command | Description |
| :--- | :--- |
| `/antinuke config` | View full antinuke limits, punishments, trust status, and floor role status at a glance. |
| `/antinuke enable` / `disable` | Enable or disable antinuke protection for the server. |
| `/antinuke limit set <category> <threshold> <window_seconds> [punishment]` | Configure custom limits and time windows per event category. |
| `/antinuke limit view` | View all configured category thresholds and punishments. |
| `/antinuke punish set <category> <action>` | Set punishment (`ban`, `kick`, `strip_roles`, `quarantine`) for a category. |
| `/antinuke whitelist add <user>` / `remove <user>` / `list` | Manage users exempt from rolling action limits. |
| `/antinuke extraowner add <user>` / `remove <user>` / `list` | Delegate antinuke configuration privileges to trusted co-admins. |
| `/antinuke floor-role setup` | Create and position the permission-less bulk-ban floor role right below the bot. |
| `/antinuke floor-role inspect` | Check role hierarchy and verify which elevated roles sit above or below the floor. |
| `/antinuke log set <channel>` | Set the dedicated channel for real-time security alerts and intercepted actions. |

---

### 🔨 Moderation & Automod
| Command | Description |
| :--- | :--- |
| `/ban <target> [reason] [delete_messages]` | Ban a member with role hierarchy checks. |
| `/unban <user_id> [reason]` | Unban a user by ID. |
| `/kick <target> [reason]` | Kick a member from the server. |
| `/timeout <target> <duration> [reason]` | Timeout (mute) a member (e.g. `10m`, `2h`, `7d`). |
| `/untimeout <target> [reason]` | Remove timeout from a member. |
| `/warn <target> <reason>` | Issue a formal warning and log it in the database. |
| `/warnings <target>` | View active warning history for a member. |
| `/clearwarn [target] [warning_id]` | Clear all warnings for a user or remove a single warning by ID. |
| `/purge <amount> [user]` | Bulk delete 1-100 messages (optionally filtered by user). |
| `/lock [reason]` | Lock the current channel preventing `@everyone` from sending messages. |
| `/unlock [reason]` | Unlock the current channel. |
| `/slowmode <seconds>` | Set rate limit per user for the channel (0 to disable). |
| `/nuke` | Recreate and completely wipe the current channel. |
| `/automod config` | View current automod filter status and penalty action. |
| `/automod anti-spam <enabled>` | Toggle burst message spam filter. |
| `/automod anti-links <enabled>` | Toggle unauthorized link filter. |
| `/automod anti-invites <enabled>` | Toggle Discord server invite filter. |
| `/automod badwords <add/remove/list/clear>` | Manage blacklisted words filter. |
| `/automod action <warn/timeout/kick>` | Set default penalty for automod violations. |

---

### 📩 Support Tickets (`/ticket`)
| Command | Description |
| :--- | :--- |
| `/ticket setup <channel> <category> <support_role>` | Post an interactive embed panel with a **📩 Create Ticket** button. |
| `/ticket close [reason]` | Close the active ticket, generate an HTML transcript, and archive it. |
| `/ticket transcript` | Export a clean HTML transcript of the current ticket channel. |
| `/ticket add <user>` | Add a member to the current ticket channel. |
| `/ticket remove <user>` | Remove a member from the current ticket channel. |

---

### 🎉 Giveaways (`/giveaway`)
| Command | Description |
| :--- | :--- |
| `/giveaway start <duration> <winners> <prize> [channel] [role]` | Start a persistent giveaway with interactive **🎉 Enter** button. |
| `/giveaway end <message_id>` | Immediately end a giveaway and choose winners. |
| `/giveaway reroll <message_id> [winners]` | Pick new winner(s) from existing participants. |
| `/giveaway list` | List all active giveaways in the server. |

---

### 🎭 Vanity & Reaction Roles
| Command | Description |
| :--- | :--- |
| `/vanityrole set <role> <string>` | Automatically award a role to members with your vanity URL/invite in their status. |
| `/vanityrole remove` | Disable vanity status role rewards. |
| `/vanityrole status` | View active vanity role configuration. |
| `/reactionrole panel <channel> <title> <description>` | Create a button reaction role panel embed. |
| `/reactionrole add <message_id> <role> <label> [emoji]` | Add self-assignable role buttons to the panel. |

---

### 👋 Welcomer (`/welcomer`)
| Command | Description |
| :--- | :--- |
| `/welcomer channel <channel>` | Set channel for welcome greeting messages. |
| `/welcomer message <content>` | Set template (supports `{user}`, `{server}`, `{membercount}`). |
| `/welcomer autorole <role> [target: human/bot]` | Assign auto-roles to new humans or bots upon joining. |
| `/welcomer toggle <enabled>` | Enable or disable welcomer greeting system. |
| `/welcomer test` | Preview your welcome embed in the current channel. |

---

### 🎵 Music (`/music`)
| Command | Description |
| :--- | :--- |
| `/music play <query/url>` | Play audio or YouTube search in your voice channel. |
| `/music skip` | Skip the current track. |
| `/music stop` | Stop playback, clear queue, and leave channel. |
| `/music pause` / `resume` | Pause or resume audio playback. |
| `/music queue` | Display upcoming tracks. |
| `/music nowplaying` | Display current track, volume, and repeat status. |
| `/music volume <0-200>` | Adjust audio playback volume. |
| `/music loop <off/track/queue>` | Set loop mode. |

---

### 🛠️ Utility & Fun
- `/serverinfo`, `/userinfo`, `/botinfo`, `/avatar`, `/banner`, `/roles`, `/role`, `/poll`, `/embed`, `/ping`, `/logging`
- `/8ball`, `/trivia`, `/meme`, `/coinflip`, `/roll`, `/rps`, `/quote`, `/joke`

---

## ⚙️ Setup & Running

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Configure `.env`:**
   ```env
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_bot_client_id_here
   GUILD_ID=
   ```

3. **Deploy Slash Commands:**
   ```bash
   npm run deploy
   ```

4. **Start the Bot:**
   ```bash
   npm start
   ```

5. **Run Automated Test Suite:**
   ```bash
   npm test
   ```
