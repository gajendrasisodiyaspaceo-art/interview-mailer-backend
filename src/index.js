const express = require('express');
const cors = require('cors');
const os = require('os');

require('./db');
const { startCron } = require('./cron');

const settingsRouter = require('./routes/settings');
const templateRouter = require('./routes/template');
const resumeRouter = require('./routes/resume');
const emailsRouter = require('./routes/emails');
const historyRouter = require('./routes/history');
const runRouter = require('./routes/run');

const PORT = Number(process.env.PORT) || 4000;
const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use('/settings', settingsRouter);
app.use('/template', templateRouter);
app.use('/resume', resumeRouter);
app.use('/emails', emailsRouter);
app.use('/history', historyRouter);
app.use('/run', runRouter);

app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: err && err.message ? err.message : 'Internal error' });
});

function getLanIPs() {
  const ifaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[BOOT] interview-mailer backend listening on 0.0.0.0:${PORT}`);
  const ips = getLanIPs();
  if (ips.length) {
    console.log('[BOOT] Reachable on LAN at:');
    ips.forEach((ip) => console.log(`         http://${ip}:${PORT}`));
  }
  startCron();
});
