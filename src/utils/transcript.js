class TranscriptGenerator {
  /**
   * Generates a modern HTML transcript from Discord messages in a ticket channel
   */
  static async generateHtml(channel, messages) {
    const sortedMessages = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    const messageHtml = sortedMessages
      .map(msg => {
        const time = new Date(msg.createdTimestamp).toLocaleString();
        const avatar = msg.author.displayAvatarURL({ dynamic: true, size: 64 });
        const content = msg.cleanContent
          ? msg.cleanContent.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
          : '';

        let attachmentsHtml = '';
        if (msg.attachments.size > 0) {
          attachmentsHtml = Array.from(msg.attachments.values())
            .map(att => `<div class="attachment"><a href="${att.url}" target="_blank">📎 ${att.name}</a></div>`)
            .join('');
        }

        let embedsHtml = '';
        if (msg.embeds.length > 0) {
          embedsHtml = msg.embeds
            .map(e => `
              <div class="embed" style="border-left: 4px solid ${e.hexColor || '#5865F2'};">
                ${e.title ? `<div class="embed-title">${e.title}</div>` : ''}
                ${e.description ? `<div class="embed-desc">${e.description}</div>` : ''}
              </div>
            `)
            .join('');
        }

        return `
          <div class="message">
            <img class="avatar" src="${avatar}" alt="${msg.author.username}" />
            <div class="message-body">
              <div class="message-header">
                <span class="username">${msg.author.tag}</span>
                ${msg.author.bot ? '<span class="bot-tag">BOT</span>' : ''}
                <span class="timestamp">${time}</span>
              </div>
              <div class="content">${content}</div>
              ${attachmentsHtml}
              ${embedsHtml}
            </div>
          </div>
        `;
      })
      .join('');

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ticket Transcript - #${channel.name}</title>
        <style>
          body {
            background-color: #313338;
            color: #dbdee1;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 20px;
          }
          .header {
            border-bottom: 1px solid #3f4147;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .header h1 {
            color: #f2f3f5;
            margin: 0 0 8px 0;
            font-size: 20px;
          }
          .header .meta {
            font-size: 13px;
            color: #949ba4;
          }
          .message {
            display: flex;
            margin-bottom: 16px;
            padding: 4px 0;
          }
          .message:hover {
            background-color: #2e3035;
          }
          .avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            margin-right: 16px;
          }
          .message-body {
            flex: 1;
          }
          .message-header {
            display: flex;
            align-items: baseline;
            margin-bottom: 4px;
          }
          .username {
            font-weight: 600;
            color: #f2f3f5;
            margin-right: 8px;
          }
          .bot-tag {
            background-color: #5865f2;
            color: #fff;
            font-size: 10px;
            font-weight: 700;
            padding: 1px 4px;
            border-radius: 3px;
            margin-right: 8px;
          }
          .timestamp {
            font-size: 12px;
            color: #949ba4;
          }
          .content {
            font-size: 15px;
            line-height: 1.375rem;
            color: #dbdee1;
          }
          .attachment {
            margin-top: 6px;
            font-size: 14px;
          }
          .attachment a {
            color: #00a8fc;
            text-decoration: none;
          }
          .embed {
            background: #2b2d31;
            border-radius: 4px;
            padding: 10px 14px;
            margin-top: 8px;
            max-width: 520px;
          }
          .embed-title {
            font-weight: 600;
            color: #f2f3f5;
            margin-bottom: 4px;
          }
          .embed-desc {
            font-size: 14px;
            color: #dbdee1;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Ticket Transcript: #${channel.name}</h1>
          <div class="meta">Guild: ${channel.guild.name} (${channel.guild.id}) | Total Messages: ${sortedMessages.length} | Exported: ${new Date().toLocaleString()}</div>
        </div>
        <div class="messages">
          ${messageHtml}
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generates a plain-text transcript
   */
  static generateText(channel, messages) {
    const sortedMessages = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    let output = `Ticket Transcript: #${channel.name} | Guild: ${channel.guild.name} (${channel.guild.id})\n`;
    output += `Generated at: ${new Date().toISOString()}\n`;
    output += `================================================================================\n\n`;

    for (const msg of sortedMessages) {
      const time = new Date(msg.createdTimestamp).toISOString();
      output += `[${time}] ${msg.author.tag}: ${msg.cleanContent || ''}\n`;
      if (msg.attachments.size > 0) {
        output += `  Attachments: ${Array.from(msg.attachments.values()).map(a => a.url).join(', ')}\n`;
      }
    }

    return output;
  }
}

module.exports = TranscriptGenerator;
