const db = require('./src/database/db');

db.run("UPDATE bot_branding SET activity_text = '/antinuke | 𝐌𝐢𝐚 ⚚ Security'");
db.run("UPDATE server_branding SET author_name = '𝐌𝐢𝐚 ⚚', footer_text = '𝐌𝐢𝐚 ⚚ • Security & Operations'");

console.log('Bot Branding:', db.all('SELECT * FROM bot_branding'));
console.log('Server Branding:', db.all('SELECT * FROM server_branding'));
