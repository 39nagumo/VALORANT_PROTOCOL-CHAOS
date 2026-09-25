// 縛りアイデア投稿を Discord に中継する Vercel Function。
// Webhook URL はブラウザに渡さず、Vercel の環境変数 DISCORD_WEBHOOK_URL から読む。

const COLORS = {
  CHAOS: 0xef4444,
  Epic: 0xa855f7,
  Exotic: 0x22c55e,
  Extra: 0xeab308,
  Unique: 0xec4899,
  Special: 0x22d3ee,
};
const MAX_LENGTH = 500;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    return res.status(500).json({ error: 'Webhook is not configured' });
  }

  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body || {};
  const category = body.category;
  const text = typeof body.text === 'string' ? body.text.trim() : '';

  if (!(category in COLORS)) {
    return res.status(400).json({ error: 'Invalid category' });
  }
  if (!text || text.length > MAX_LENGTH) {
    return res.status(400).json({ error: `Text must be 1-${MAX_LENGTH} characters` });
  }

  const payload = {
    // @everyone やロールへのメンションを無効化
    allowed_mentions: { parse: [] },
    embeds: [{
      title: '📌 新しい縛りアイデアの投稿',
      color: COLORS[category],
      fields: [
        { name: 'レアリティ', value: category, inline: true },
        { name: '内容', value: text },
      ],
      footer: { text: 'Protocol Archive Suggestion' },
      timestamp: new Date().toISOString(),
    }],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      return res.status(502).json({ error: 'Discord rejected the request' });
    }
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(502).json({ error: 'Failed to reach Discord' });
  }
}

function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
