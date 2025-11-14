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
    console.log('RAW BODY:', JSON.stringify(req.body, null, 2));
    try {
      const token = req.headers['x-workvivo-jwt'];
      if (!token) return res.status(401).json({ error: 'Missing Workvivo jwt' });
      await verifyWorkvivoRequest(token);
    } catch (e) {
      console.error('JWT fail:', e.message);
      return res.status(401).json({ error: 'Invalid signature' });
    }
  
    const webhook = req.body;
  
    // Event 1: just acknowledge
    if (webhook.action === 'chat_bot_message_sent') {
      return res.status(200).json({ success: true });
    }
  
    // Event 2: actually answer
    if (webhook.category === 'bot_message_notification') {
      const userMessage = webhook.message?.text;
      if (!userMessage) return res.status(200).json({ success: true });
  
      const answer = getAnswer(userMessage);
  
      const payload = {
        bot_userid: webhook.bot.bot_userid,
        channel_url: webhook.channel.channel_url,
        type: 'message',
        message: answer
      };
  
      try {
        const workvivoResp = await axios.post(process.env.WORKVIVOAPIURL, payload, {
          headers: {
            'Workvivo-Id': process.env.WORKVIVOID,
            Authorization: `Bearer ${process.env.WORKVIVOTOKEN}`,
            'Content-Type': 'application/json'
          }
        });
        console.log('Reply sent, status:', workvivoResp.status);
        return res.status(200).json({ success: true });
      } catch (axErr) {
        console.error('Workvivo POST fail:', axErr.response?.data || axErr.message);
        return res.status(500).json({ error: 'Failed to send reply' });
      }
    }
  
    res.status(200).json({ error: 'No action defined' });
  });

// health check
app.get('/', (_, res) => res.send('Workvivo Demo-Bot running'));

app.listen(port, () => console.log(`Demo-Bot listening on :${port}`));