/**
 * Check if a Discord user ID belongs to the Bot Owner (or Team Member)
 * Supports client.application owner resolution, OWNER_ID, and OWNER_IDS in .env
 */
async function isBotOwner(client, userId) {
  if (!userId) return false;

  // 1. Check environment variables if defined
  const envOwner = process.env.OWNER_ID;
  const envOwners = process.env.OWNER_IDS ? process.env.OWNER_IDS.split(',').map(s => s.trim()) : [];
  if (envOwner && envOwner === userId) return true;
  if (envOwners.includes(userId)) return true;

  // 2. Check Discord Application Owner (User or Team)
  try {
    if (client && (!client.application?.owner)) {
      await client.application?.fetch();
    }

    const owner = client?.application?.owner;
    if (!owner) return false;

    // Single User Owner
    if (owner.id && owner.id === userId) return true;

    // Team Owner (Team members / Team Owner)
    if (owner.members) {
      if (owner.members.has(userId)) return true;
      if (owner.ownerId === userId) return true;
    }
  } catch (err) {
    // If API fetch fails, fallback to false
  }

  return false;
}

module.exports = isBotOwner;
