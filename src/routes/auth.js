const express = require('express');
const { google } = require('googleapis');
const { db } = require('../db');

const router = express.Router();

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'https://interview-mailer-backend.onrender.com/auth/google/callback'
  );
}

// GET /auth/google/url — returns the Google OAuth consent URL
router.get('/google/url', (_req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ error: 'Google OAuth not configured on server.' });
  }
  const client = getOAuthClient();
  const url = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/userinfo.email'],
  });
  res.json({ url });
});

// GET /auth/google/callback — Google redirects here after user approves
router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) {
    return res.send('<h2>Auth cancelled.</h2><p>Close this tab and try again.</p>');
  }
  try {
    const client = getOAuthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data } = await oauth2.userinfo.get();
    const email = data.email || '';

    db.prepare(`
      UPDATE settings SET
        google_access_token = ?,
        google_refresh_token = ?,
        google_email = ?
      WHERE id = 1
    `).run(tokens.access_token || '', tokens.refresh_token || '', email);

    res.send(`
      <h2 style="font-family:sans-serif;color:#2563eb">Gmail Connected!</h2>
      <p style="font-family:sans-serif">Logged in as <b>${email}</b>.<br>Close this tab and return to the app.</p>
    `);
  } catch (err) {
    console.error('[AUTH] callback error', err);
    res.status(500).send('<h2>Auth failed.</h2><p>' + (err.message || err) + '</p>');
  }
});

// GET /auth/google/status — mobile polls this to check if connected
router.get('/google/status', (_req, res) => {
  const row = db.prepare('SELECT google_email, google_refresh_token FROM settings WHERE id = 1').get();
  res.json({
    connected: !!(row.google_refresh_token),
    email: row.google_email || '',
  });
});

// DELETE /auth/google — disconnect Gmail
router.delete('/google', (_req, res) => {
  db.prepare(`UPDATE settings SET google_access_token='', google_refresh_token='', google_email='' WHERE id=1`).run();
  res.json({ ok: true });
});

module.exports = router;
