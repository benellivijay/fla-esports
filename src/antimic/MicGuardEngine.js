const { EndBehaviorType } = require('@discordjs/voice');
const OpusScript = require('opusscript');
const micGuardManager = require('../database/managers/MicGuardManager');
const EmbedGenerator = require('../utils/embed');
const Logger = require('../utils/logger');

// Per-user decoder pool — one OpusScript per user, avoids heap corruption
// Note: OpusScript instances are lightweight and safe when used one-per-user
class MicGuardEngine {
  constructor() {
    this.speakerStates = new Map(); // userId -> { score, totalFrames, highestRms, highestClip }
    this.userCooldowns = new Map(); // userId -> timestamp
    this.activeSubscriptions = new Map(); // userId -> { audioStream, decoder }
    this.attachedConnections = new Set(); // connection references
  }

  // Create a fresh OpusScript decoder for a single user
  createDecoder() {
    try {
      return new OpusScript(48000, 2, OpusScript.Application.AUDIO, { wasm: true });
    } catch (e) {
      Logger.warn(`[MIC GUARD] Failed to create OpusScript decoder: ${e.message}`);
      return null;
    }
  }

  analyzePcmBuffer(pcmBuffer) {
    if (!pcmBuffer || pcmBuffer.length < 4) return { rms: 0, clipRatio: 0 };
    let sumSquares = 0;
    let clippedCount = 0;
    const numSamples = Math.floor(pcmBuffer.length / 2);

    for (let i = 0; i + 1 < pcmBuffer.length; i += 2) {
      const sample = pcmBuffer.readInt16LE(i);
      sumSquares += sample * sample;
      if (Math.abs(sample) >= 31000) {
        clippedCount++;
      }
    }

    const rms = Math.sqrt(sumSquares / numSamples) / 32768;
    const clipRatio = clippedCount / numSamples;
    return { rms, clipRatio };
  }

  calculateAbuseWeight(rms, clipRatio, sensitivity, pktSize) {
    // ─────────────────────────────────────────────────────────────────
    // CORE PRINCIPLE:
    // Normal human speech (even very loud screaming): packets are 40–400 bytes
    //   because Discord Opus uses VBR — less audio energy = smaller packet.
    // Louder Mic / Gain Booster apps force CBR at max bitrate: 900–1400 bytes.
    //
    // We ONLY trigger on big packets (≥ 900 bytes) to achieve ZERO false positives.
    // Normal speakers can never send 900+ byte packets no matter how loud they are.
    // ─────────────────────────────────────────────────────────────────

    const bigPacket = pktSize >= 900; // only louder mic / CBR booster produces this
    if (!bigPacket) return 0;         // ← 100% immunity for all normal speakers

    switch (sensitivity) {
      case 'high':
        if (clipRatio >= 0.55 && rms >= 0.80) return 2;
        if (clipRatio >= 0.45 && rms >= 0.70) return 1;
        return 0;

      case 'lenient':
        if (clipRatio >= 0.70 && rms >= 0.88) return 2;
        if (clipRatio >= 0.60 && rms >= 0.82) return 1;
        return 0;

      case 'standard':
      default:
        if (clipRatio >= 0.60 && rms >= 0.80) return 2;
        if (clipRatio >= 0.50 && rms >= 0.75) return 1;
        return 0;
    }
  }

  getTriggerThreshold(sensitivity) {
    switch (sensitivity) {
      case 'high': return 2.0;
      case 'lenient': return 3.0;
      case 'standard':
      default: return 2.0;
    }
  }

  cleanupUser(userId) {
    if (this.activeSubscriptions.has(userId)) {
      try {
        const sub = this.activeSubscriptions.get(userId);
        sub?.audioStream?.destroy();
        // OpusScript has no destroy(), it's GC'd
      } catch {}
      this.activeSubscriptions.delete(userId);
    }
    this.speakerStates.delete(userId);
  }

  subscribeUser(receiver, guild, userId, textChannel = null) {
    if (!userId || this.activeSubscriptions.has(userId)) return;

    const config = micGuardManager.getConfig(guild.id);
    if (!config || !config.enabled) return;

    const member = guild.members.cache.get(userId);
    if (member && member.user.bot) return;

    const sensitivity = config.sensitivity || 'standard';
    const triggerThreshold = this.getTriggerThreshold(sensitivity);
    const speakerState = {
      score: 0,
      totalFrames: 0,
      highestRms: 0,
      highestClip: 0
    };
    this.speakerStates.set(userId, speakerState);

    // Create a per-user OpusScript decoder — this is the correct approach for objectMode streams
    const decoder = this.createDecoder();
    if (!decoder) {
      Logger.warn(`[MIC GUARD] Cannot monitor ${userId} — no decoder available`);
      return;
    }

    try {
      // AudioReceiveStream is objectMode: true — each 'data' event = one raw Opus packet Buffer
      // We CANNOT pipe it into Prism; we must decode each packet manually with OpusScript
      const audioStream = receiver.subscribe(userId, {
        end: { behavior: EndBehaviorType.Manual }
      });

      this.activeSubscriptions.set(userId, { audioStream, decoder });
      const userTag = member?.user?.tag || `User ${userId}`;
      Logger.info(`[MIC GUARD] 🎧 Subscribed to: ${userTag} (${userId})`);

      audioStream.on('data', async (opusPacket) => {
        // opusPacket is a raw Opus Buffer from the Discord voice stream (already RTP-decrypted)
        if (!opusPacket || opusPacket.length < 3) return;

        // Skip silence frames (Discord sends 0xF8,0xFF,0xFE as DTX silence marker)
        if (opusPacket.length === 3 &&
            opusPacket[0] === 0xF8 && opusPacket[1] === 0xFF && opusPacket[2] === 0xFE) {
          return;
        }

        let pcmBuffer;
        try {
          pcmBuffer = decoder.decode(opusPacket);
        } catch (e) {
          return; // bad packet, skip
        }

        if (!pcmBuffer || pcmBuffer.length < 4) return;

        const { rms, clipRatio } = this.analyzePcmBuffer(pcmBuffer);
        speakerState.totalFrames++;

        // Skip first 3 warmup frames to ignore connection click/pop artifacts
        if (speakerState.totalFrames <= 3) return;

        if (rms > speakerState.highestRms) speakerState.highestRms = rms;
        if (clipRatio > speakerState.highestClip) speakerState.highestClip = clipRatio;

        // Log every 5 frames so we can monitor in real-time
        if (speakerState.totalFrames % 5 === 0) {
          Logger.info(
            `[MIC GUARD] 📊 ${userTag}: RMS=${(rms * 100).toFixed(1)}% Clip=${(clipRatio * 100).toFixed(1)}% pkt=${opusPacket.length}b frames=${speakerState.totalFrames}`
          );
        }

        const weight = this.calculateAbuseWeight(rms, clipRatio, sensitivity, opusPacket.length);
        if (weight > 0) {
          speakerState.score += weight;
          Logger.info(
            `[MIC GUARD] 🚨 ABUSE ${userTag}: RMS=${(rms * 100).toFixed(1)}% Clip=${(clipRatio * 100).toFixed(1)}% +${weight} score=${speakerState.score.toFixed(1)}/${triggerThreshold}`
          );
        } else {
          speakerState.score = Math.max(0, speakerState.score - 0.1);
        }

        if (speakerState.score >= triggerThreshold) {
          speakerState.score = 0;
          this.cleanupUser(userId);
          const targetMember = member || (await guild.members.fetch(userId).catch(() => null));
          if (targetMember) {
            this.handleAbuse(guild, targetMember, speakerState, textChannel);
          }
        }
      });

      audioStream.on('end', () => this.cleanupUser(userId));
      audioStream.on('error', () => this.cleanupUser(userId));

    } catch (subErr) {
      Logger.warn(`[MIC GUARD] Error subscribing to ${userId}: ${subErr.message}`);
      this.cleanupUser(userId);
    }
  }

  attach(voiceConnection, guild, textChannel = null) {
    if (!voiceConnection || !guild) return;

    if (this.attachedConnections.has(voiceConnection)) return;
    this.attachedConnections.add(voiceConnection);

    const receiver = voiceConnection.receiver;
    if (!receiver) {
      Logger.warn(`[MIC GUARD] VoiceReceiver not available for guild: ${guild.name}`);
      return;
    }

    Logger.info(`[MIC GUARD] ✅ Voice Guard active in "${guild.name}"`);

    // Subscribe to every existing member in the voice channel
    const channelId = voiceConnection.joinConfig.channelId;
    const voiceChannel = guild.channels.cache.get(channelId);
    if (voiceChannel && voiceChannel.members) {
      for (const member of voiceChannel.members.values()) {
        if (!member.user.bot) {
          this.subscribeUser(receiver, guild, member.id, textChannel);
        }
      }
    }

    // Subscribe when a user starts speaking (also covers new joiners)
    if (receiver.speaking) {
      receiver.speaking.on('start', (userId) => {
        this.subscribeUser(receiver, guild, userId, textChannel);
      });
    }

    // Subscribe on new SSRC mappings (catches users who joined before bot)
    if (receiver.ssrcMap) {
      receiver.ssrcMap.on('create', (data) => {
        if (data?.userId) this.subscribeUser(receiver, guild, data.userId, textChannel);
      });
      receiver.ssrcMap.on('update', (_, newData) => {
        if (newData?.userId) this.subscribeUser(receiver, guild, newData.userId, textChannel);
      });
    }
  }

  async handleAbuse(guild, member, stats, textChannel) {
    const userId = member.id;
    const now = Date.now();

    const lastAction = this.userCooldowns.get(userId) || 0;
    if (now - lastAction < 2000) return;
    this.userCooldowns.set(userId, now);

    const voiceChannel = member.voice?.channel;
    if (!voiceChannel) return;

    const warnCount = micGuardManager.addWarning(guild.id, userId);

    Logger.warn(
      `🚨 [LOUDER MIC] Guild: "${guild.name}" | ${member.user.tag} | Warn: ${warnCount}/2 | ` +
      `Peak RMS: ${(stats.highestRms * 100).toFixed(1)}% | Clip: ${(stats.highestClip * 100).toFixed(1)}%`
    );

    if (warnCount >= 2) {
      // Disconnect from voice
      try {
        if (member.voice?.channel) {
          await member.voice.setChannel(null, 'Louder Mic Guard: 2 warnings reached');
        }
      } catch (e) {
        Logger.error(`[MIC GUARD] Disconnect failed: ${e.message}`);
      }

      // 7-minute server timeout
      try {
        await member.timeout(7 * 60 * 1000, 'Louder Mic Guard: 2 warnings — louder mic abuse');
      } catch (e) {
        Logger.warn(`[MIC GUARD] Timeout failed (role hierarchy?): ${e.message}`);
      }

      micGuardManager.resetWarnings(guild.id, userId);

      // Timeout DM
      try {
        const embed = EmbedGenerator.base()
          .setTitle('⛔ Voice Timeout — 2 Warnings Reached')
          .setColor(0xED4245)
          .setDescription(
            `You have received **2 Louder Mic warnings** in **${guild.name}** and have been **timed out for 7 minutes**.\n\n` +
            `⏱️ **Timeout:** \`7 Minutes\`\n` +
            `🔊 **Reason:** Modified louder mic / gain booster / earrape.\n\n` +
            `*Lower your mic gain before returning.*`
          )
          .setFooter({ text: 'Mia Voice Security' })
          .setTimestamp();
        await member.send({ embeds: [embed] }).catch(() => null);
      } catch {}

      // Channel alert
      try {
        const alert = EmbedGenerator.security(
          '⛔ Louder Mic — Timed Out (2/2 Warnings)',
          `**Offender:** ${member.user.tag} (<@${member.id}>)\n` +
          `**Channel:** <#${voiceChannel.id}>\n` +
          `**Action:** ⏱️ 7-minute timeout + voice disconnect`
        );
        const ch = voiceChannel.isTextBased?.() ? voiceChannel : textChannel;
        if (ch) await ch.send({ embeds: [alert] }).catch(() => null);
      } catch {}

      return;
    }

    // Warning 1/2 — disconnect only
    try {
      if (member.voice?.channel) {
        await member.voice.setChannel(null, `Louder Mic Guard: Warning ${warnCount}/2`);
      }
    } catch (e) {
      Logger.error(`[MIC GUARD] Disconnect failed: ${e.message}`);
    }

    // Warning DM
    try {
      const embed = EmbedGenerator.base()
        .setTitle(`⚠️ Voice Warning (${warnCount}/2) — Louder Mic Detected`)
        .setColor(0xFEE75C)
        .setDescription(
          `You were disconnected from **${voiceChannel.name}** in **${guild.name}** for using a **modified louder mic or gain booster**.\n\n` +
          `⚠️ **Warning:** \`${warnCount} / 2\`\n` +
          `📌 **2 warnings = 7-minute server timeout**\n\n` +
          `*Disable your gain booster before rejoining.*`
        )
        .setFooter({ text: 'Mia Voice Security' })
        .setTimestamp();
      await member.send({ embeds: [embed] }).catch(() => null);
    } catch {}

    // Channel alert
    try {
      const alert = EmbedGenerator.security(
        `🚨 Louder Mic Intercepted (Warning ${warnCount}/2)`,
        `**Offender:** ${member.user.tag} (<@${member.id}>)\n` +
        `**Channel:** <#${voiceChannel.id}>\n` +
        `**Warning:** \`${warnCount} / 2\` *(timeout on 2nd)*\n` +
        `**Action:** Disconnected + warning DM sent`
      );
      const ch = voiceChannel.isTextBased?.() ? voiceChannel : textChannel;
      if (ch) await ch.send({ embeds: [alert] }).catch(() => null);
    } catch {}
  }
}

module.exports = new MicGuardEngine();
