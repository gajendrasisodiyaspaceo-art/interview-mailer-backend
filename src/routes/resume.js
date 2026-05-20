const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { db, RESUME_DIR } = require('../db');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, RESUME_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.pdf';
    cb(null, `resume_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.post('/', upload.single('resume'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded (field name must be "resume")' });

  const current = db.prepare('SELECT resume_path FROM template WHERE id = 1').get();
  if (current && current.resume_path && fs.existsSync(current.resume_path)) {
    try { fs.unlinkSync(current.resume_path); } catch (_e) { /* ignore */ }
  }

  db.prepare('UPDATE template SET resume_path = ?, resume_original_name = ? WHERE id = 1')
    .run(req.file.path, req.file.originalname);

  res.json({ ok: true, resume_name: req.file.originalname, size: req.file.size });
});

router.delete('/', (_req, res) => {
  const current = db.prepare('SELECT resume_path FROM template WHERE id = 1').get();
  if (current && current.resume_path && fs.existsSync(current.resume_path)) {
    try { fs.unlinkSync(current.resume_path); } catch (_e) { /* ignore */ }
  }
  db.prepare("UPDATE template SET resume_path = '', resume_original_name = '' WHERE id = 1").run();
  res.json({ ok: true });
});

module.exports = router;
