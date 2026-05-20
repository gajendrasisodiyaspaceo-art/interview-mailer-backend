const cron = require('node-cron');
const { db } = require('./db');
const { processQueue } = require('./mailer');

function currentTimeInTz(timezone) {
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return fmt.format(new Date());
  } catch (_e) {
    return new Date().toTimeString().slice(0, 5);
  }
}

function currentDateInTz(timezone) {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return fmt.format(new Date());
  } catch (_e) {
    return new Date().toISOString().slice(0, 10);
  }
}

function startCron() {
  cron.schedule('* * * * *', async () => {
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    if (!settings || !settings.send_time) return;

    const tz = settings.timezone || 'Asia/Kolkata';
    const now = currentTimeInTz(tz);
    const today = currentDateInTz(tz);

    if (now !== settings.send_time) return;
    if (settings.last_run_date === today) return;

    db.prepare('UPDATE settings SET last_run_date = ? WHERE id = 1').run(today);

    console.log(`[CRON] Triggering queue at ${now} ${tz} on ${today}`);
    try {
      const result = await processQueue();
      console.log(`[CRON] Done — processed ${result.processed} (mode: ${result.mode})`);
    } catch (err) {
      console.error('[CRON] Error processing queue:', err);
    }
  });

  console.log('[CRON] Scheduler started — checks every minute against send_time');
}

module.exports = { startCron };
