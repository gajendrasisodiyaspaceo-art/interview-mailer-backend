const express = require('express');
const { processQueue } = require('../mailer');

const router = express.Router();

router.post('/', async (_req, res) => {
  try {
    const result = await processQueue({ force: true });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

module.exports = router;
