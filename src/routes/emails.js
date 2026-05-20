const express = require('express');
const { db } = require('../db');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get('/', (req, res) => {
  const { status } = req.query;
  let rows;
  if (status === 'pending' || status === 'sent' || status === 'failed') {
    rows = db.prepare('SELECT * FROM emails WHERE status = ? ORDER BY id DESC').all(status);
  } else {
    rows = db.prepare('SELECT * FROM emails ORDER BY id DESC').all();
  }
  res.json(rows);
});

router.post('/', (req, res) => {
  const { email, company, role } = req.body || {};
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  const trimmed = email.trim().toLowerCase();

  const exists = db.prepare('SELECT id, status FROM emails WHERE email = ?').get(trimmed);
  if (exists) {
    return res.status(409).json({
      error: `Email already in list (status: ${exists.status})`,
      existing_id: exists.id,
    });
  }

  const result = db.prepare(`
    INSERT INTO emails (email, company, role, status)
    VALUES (?, ?, ?, 'pending')
  `).run(trimmed, (company || '').trim(), (role || '').trim());

  const row = db.prepare('SELECT * FROM emails WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(row);
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  const result = db.prepare('DELETE FROM emails WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

router.post('/:id/reset', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  const result = db.prepare("UPDATE emails SET status = 'pending', sent_at = NULL WHERE id = ?").run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;
