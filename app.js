/////////////////////////////////////////////////////////////////////////////////////////////////
// Workvivo Chatbot demo – HR/IT FAQ bot
/////////////////////////////////////////////////////////////////////////////////////////////////
require('dotenv').config();
const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const axios = require('axios');app.post('/webhook', async (req, res) => {
    console.log('RAW BODY:', JSON.stringify(req.body, null, 2));
  
    // JWT verification (same as before)
    try {
      const token = req.headers['x-workvivo-jwt'];
      if (!token) return res.status(401).json({ error: 'Missing Workvivo jwt' });
      await verifyWorkvivoRequest(token);
    } catch (e) {
      console.error('JWT fail:', e.message);
      return res.status(401).json({ error: 'Invalid signature' });
    }
  
    const webhook = req.body;
  
    // Event 1: acknowledge only
    if (webhook.action === 'chat_bot_message_sent') {
      return res.status(200).json({ success: true });
    }
  
    // Event 2: reply branch
    if (webhook.category === 'bot_message_notification') {
      // ------ EXACT clone of his switch ------
      const baseRequestConfig = {
        method: 'post',
        url: process.env.WORKVIVOAPIURL,
        headers: {
          'Workvivo-Id': `${process.env.WORKVIVOID}`,
          Authorization: `Bearer ${process.env.WORKVIVOTOKEN}`,
          'Content-Type': 'application/json'
        }
      };
  
      let requestPayload;
  
      switch (webhook.message?.text?.toLowerCase()) {
        case 'card':
          requestPayload = {
            bot_userid: webhook.bot.bot_userid,
            channel_url: webhook.channel.channel_url,
            type: 'card',
            cards: [{
              cardTitle: "Welcome to Chat Demo",
              cardDescription: "demonstrating basics",
              cardImage: `${process.env.IMAGEURL}chatbot.png`,
              buttons: [
                { label: "IT Help", message: "IT Help" },
                { label: "HR Help", message: "HR Help" },
                { label: "Other", message: "Other" },
                { label: "Yahoo", link: "https://www.yahoo.co.jp/ " }
              ]
            }]
          };
          break;
  
        case 'card2':
          requestPayload = {
            bot_userid: webhook.bot.bot_userid,
            channel_url: webhook.channel.channel_url,
            type: 'card',
            cards: [
              {
                cardTitle: "Welcome to Chat Demo 1",
                cardDescription: "demonstrating basics 1",
                cardImage: `${process.env.IMAGEURL}1.png`,
                buttons: []
              },
              {
                cardTitle: "Welcome to Chat Demo 2",
                cardDescription: "demonstrating basics 2",
                cardImage: `${process.env.IMAGEURL}2.png`,
                buttons: [{ label: "IT Help 2", message: "IT Help 2" }]
              },
              {
                cardTitle: "Welcome to Chat Demo 3",
                cardDescription: "demonstrating basics 3",
                cardImage: `${process.env.IMAGEURL}3.png`,
                buttons: [
                  { label: "IT Help Button 3-1", message: "IT Help 3-1" },
                  { label: "IT Help Button 3-2", message: "IT Help 3-2" },
                  { label: "IT Help Button 3-3", message: "IT Help 3-3" }
                ]
              }
            ]
          };
          break;
  
        case 'quick':
          requestPayload = {
            bot_userid: webhook.bot.bot_userid,
            channel_url: webhook.channel.channel_url,
            type: 'quick_reply',
            replies: [
              { label: "Unable to connect to this network", message: "Unable to connect to this network" },
              { label: "Incorrect Password", message: "Incorrect Password" },
              { label: "No error message, just won’t connect", message: "No error message, just won’t connect" },
              { label: "Other", message: "Other" }
            ]
          };
          break;
  
        default:
          // DB lookup + reply (his exact pattern)
          const userMessage = webhook.message.text;
          let answer = "Sorry, I don't know the answer to that.";
          try {
            const row = db.prepare("SELECT answer FROM faqs WHERE question = ?").get(userMessage);
            if (row) answer = row.answer;
          } catch (err) {
            console.error("DB Error:", err.message);
          }
  
          requestPayload = {
            bot_userid: webhook.bot.bot_userid,
            channel_url: webhook.channel.channel_url,
            type: 'message',
            message: answer
          };
  
          const response = await axios({
            ...baseRequestConfig,
            data: requestPayload
          });
  
          console.log('API Response:', JSON.stringify(response.data, null, 2));
          return res.status(200).json({ success: true });
      }
  
      console.log("No action defined from webhook");
      return res.status(200).json({ error: 'No action defined from webhook' });
    }
  
    res.status(200).json({ success: true });
  });
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
      console.log('ANSWER:', answer, '-> posting to Workvivo');
  
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
        console.log('Workvivo reply status:', workvivoResp.status);
        return res.status(200).json({ success: true });
      } catch (axErr) {
        console.error('Full axios error:', {
          message: axErr.message,
          response: axErr.response?.data,
          status: axErr.response?.status,
          url: process.env.WORKVIVOAPIURL,
          headersSent: { 'Workvivo-Id': process.env.WORKVIVOID }
        });
        return res.status(500).json({ error: 'Failed to send reply' });
      }
    }
  
    res.status(200).json({ success: true });
  });

// health check
app.get('/', (_, res) => res.send('Workvivo Demo-Bot running'));

app.listen(port, () => console.log(`Demo-Bot listening on :${port}`));