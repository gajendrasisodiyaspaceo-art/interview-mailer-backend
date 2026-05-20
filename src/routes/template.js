const express = require('express');
const { db } = require('../db');

const router = express.Router();

router.get('/', (_req, res) => {
  const row = db.prepare('SELECT id, subject, body, resume_original_name FROM template WHERE id = 1').get();
  res.json({
    subject: row.subject || '',
    body: row.body || '',
    resume_name: row.resume_original_name || '',
  });
});

router.put('/', (req, res) => {
  const { subject, body } = req.body || {};
  const current = db.prepare('SELECT * FROM template WHERE id = 1').get();
  const nextSubject = typeof subject === 'string' ? subject : current.subject;
  const nextBody = typeof body === 'string' ? body : current.body;
  db.prepare('UPDATE template SET subject = ?, body = ? WHERE id = 1').run(nextSubject, nextBody);
  res.json({ ok: true });
});

module.exports = router;
