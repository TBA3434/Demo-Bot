/////////////////////////////////////////////////////////////////////////////////////////////////
// Workvivo Chatbot demo – HR/IT FAQ bot
/////////////////////////////////////////////////////////////////////////////////////////////////
require('dotenv').config();
const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const axios = require('axios');
const Database = require('better-sqlite3');

const port = process.env.PORT || 10000;
const db = new Database('db/faq.db');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// verify Workvivo JWT
async function verifyWorkvivoRequest(token) {
  const decoded = jwt.decode(token, { complete: true });
  const client = jwksClient({ jwksUri: decoded.payload.publicKeyUrl });
  const key = await client.getSigningKey(decoded.header.kid);
  return jwt.verify(token, key.getPublicKey());
}

// answer lookup
function getAnswer(q) {
  const row = db.prepare('SELECT answer FROM faqs WHERE question = ?').get(q);
  return row ? row.answer : "Sorry, I don't know the answer to that.";
}

// webhook entry
app.post('/webhook', async (req, res) => {
  try {
    const token = req.headers['x-workvivo-jwt'];
    if (!token) return res.status(401).json({ error: 'Missing Workvivo jwt' });
    await verifyWorkvivoRequest(token);

    const { action, category, message, bot, channel } = req.body;

    if (action === 'chat_bot_message_sent' || category === 'bot_message_notification') {
      const answer = getAnswer(message?.text);
      const payload = {
        bot_userid: bot.bot_userid,
        channel_url: channel.channel_url,
        type: 'message',
        message: answer
      };

      await axios.post(process.env.WORKVIVOAPIURL, payload, {
        headers: {
          'Workvivo-Id': process.env.WORKVIVOID,
          Authorization: `Bearer ${process.env.WORKVIVOTOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      return res.status(200).json({ success: true });
    }
    res.status(200).json({ error: 'No action defined' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal error' });
  }
});

// health check
app.get('/', (_, res) => res.send('Workvivo Demo-Bot running'));

app.listen(port, () => console.log(`Demo-Bot listening on :${port}`));