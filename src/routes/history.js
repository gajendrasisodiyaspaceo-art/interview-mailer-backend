const express = require('express');
const { db } = require('../db');

const router = express.Router();

router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM history ORDER BY id DESC LIMIT 200').all();
  res.json(rows);
});

router.delete('/', (_req, res) => {
  db.prepare('DELETE FROM history').run();
  res.json({ ok: true });
});

module.exports = router;
