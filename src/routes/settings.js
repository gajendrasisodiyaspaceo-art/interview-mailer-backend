const express = require('express');
const { db } = require('../db');

const router = express.Router();

router.get('/', (_req, res) => {
  const row = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  res.json({
    smtp_user: row.smtp_user || '',
    smtp_pass_set: Boolean(row.smtp_pass),
    sender_name: row.sender_name || '',
    send_time: row.send_time || '09:00',
    timezone: row.timezone || 'Asia/Kolkata',
  });
});

router.put('/', (req, res) => {
  const { smtp_user, smtp_pass, sender_name, send_time, timezone } = req.body || {};

  const current = db.prepare('SELECT * FROM settings WHERE id = 1').get();

  const next = {
    smtp_user: typeof smtp_user === 'string' ? smtp_user.trim() : current.smtp_user,
    smtp_pass: typeof smtp_pass === 'string' && smtp_pass.length > 0 ? smtp_pass : current.smtp_pass,
    sender_name: typeof sender_name === 'string' ? sender_name.trim() : current.sender_name,
    send_time: typeof send_time === 'string' && /^\d{2}:\d{2}$/.test(send_time) ? send_time : current.send_time,
    timezone: typeof timezone === 'string' && timezone ? timezone : current.timezone,
  };

  db.prepare(`
    UPDATE settings
    SET smtp_user = ?, smtp_pass = ?, sender_name = ?, send_time = ?, timezone = ?
    WHERE id = 1
  `).run(next.smtp_user, next.smtp_pass, next.sender_name, next.send_time, next.timezone);

  res.json({ ok: true });
});

router.delete('/smtp-pass', (_req, res) => {
  db.prepare("UPDATE settings SET smtp_pass = '' WHERE id = 1").run();
  res.json({ ok: true });
});

module.exports = router;
