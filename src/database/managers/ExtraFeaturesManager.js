const db = require('../db');

class ExtraFeaturesManager {
  // Autoresponder
  addAutoresponder(guildId, trigger, reply) {
    return db.run(
      'INSERT INTO autoresponders (guild_id, trigger, reply, created_at) VALUES (?, ?, ?, ?)',
      guildId,
      trigger.toLowerCase(),
      reply,
      Date.now()
    );
  }

  removeAutoresponder(guildId, trigger) {
    return db.run('DELETE FROM autoresponders WHERE guild_id = ? AND trigger = ?', guildId, trigger.toLowerCase());
  }

  getAutoresponders(guildId) {
    return db.all('SELECT * FROM autoresponders WHERE guild_id = ?', guildId);
  }

  getAutoresponder(guildId, trigger) {
    return db.get('SELECT * FROM autoresponders WHERE guild_id = ? AND trigger = ?', guildId, trigger.toLowerCase());
  }

  // VoiceMaster
  getVoiceMasterConfig(guildId) {
    return db.get('SELECT * FROM voicemaster_config WHERE guild_id = ?', guildId);
  }

  setVoiceMasterConfig(guildId, categoryId, channelId, interfaceChannelId = null, interfaceMessageId = null, enabledButtons = ['all']) {
    const buttonsJson = typeof enabledButtons === 'string' ? enabledButtons : JSON.stringify(enabledButtons);
    return db.run(
      `INSERT INTO voicemaster_config (guild_id, category_id, channel_id, interface_channel_id, interface_message_id, enabled_buttons, enabled)
       VALUES (?, ?, ?, ?, ?, ?, 1)
       ON CONFLICT(guild_id) DO UPDATE SET
         category_id = excluded.category_id,
         channel_id = excluded.channel_id,
         interface_channel_id = COALESCE(excluded.interface_channel_id, voicemaster_config.interface_channel_id),
         interface_message_id = COALESCE(excluded.interface_message_id, voicemaster_config.interface_message_id),
         enabled_buttons = excluded.enabled_buttons,
         enabled = 1`,
      guildId,
      categoryId,
      channelId,
      interfaceChannelId,
      interfaceMessageId,
      buttonsJson
    );
  }

  addTempVoice(channelId, guildId, ownerId) {
    return db.run(
      'INSERT INTO temp_voice_channels (channel_id, guild_id, owner_id, created_at) VALUES (?, ?, ?, ?)',
      channelId,
      guildId,
      ownerId,
      Date.now()
    );
  }

  getTempVoice(channelId) {
    return db.get('SELECT * FROM temp_voice_channels WHERE channel_id = ?', channelId);
  }

  getTempVoiceByOwner(guildId, ownerId) {
    return db.get('SELECT * FROM temp_voice_channels WHERE guild_id = ? AND owner_id = ?', guildId, ownerId);
  }

  updateTempVoiceOwner(channelId, newOwnerId) {
    return db.run('UPDATE temp_voice_channels SET owner_id = ? WHERE channel_id = ?', newOwnerId, channelId);
  }

  removeTempVoice(channelId) {
    return db.run('DELETE FROM temp_voice_channels WHERE channel_id = ?', channelId);
  }
}

module.exports = new ExtraFeaturesManager();
