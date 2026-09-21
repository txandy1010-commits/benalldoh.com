// /api/chat-stats.js
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  // Use your Neon connection string stored in environment variables
  const sql = neon(process.env.DATABASE_URL);

  if (req.method === 'GET') {
    // Fetch top 10 chatters & total messages globally for ALL users
    const topChatters = await sql`
      SELECT display_name, chat_count 
      FROM chatters 
      ORDER BY chat_count DESC 
      LIMIT 10
    `;
    
    const totalMsgs = await sql`
      SELECT stat_value FROM channel_stats WHERE stat_key = 'total_messages'
    `;

    return res.status(200).json({
      totalMessages: totalMsgs[0]?.stat_value || 148920,
      topChatters: topChatters
    });
  }

  if (req.method === 'POST') {
    const { username, displayName } = req.body;
    if (!username) return res.status(400).json({ error: 'Missing username' });

    // Atomically increment chat count in Neon DB
    await sql`
      INSERT INTO chatters (username, display_name, chat_count, last_updated)
      VALUES (${username.toLowerCase()}, ${displayName}, 1, NOW())
      ON CONFLICT (username) 
      DO UPDATE SET 
        chat_count = chatters.chat_count + 1,
        display_name = EXCLUDED.display_name,
        last_updated = NOW();
    `;

    await sql`
      UPDATE channel_stats 
      SET stat_value = stat_value + 1 
      WHERE stat_key = 'total_messages';
    `;

    return res.status(200).json({ success: true });
  }
}
