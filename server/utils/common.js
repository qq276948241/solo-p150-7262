const pool = require('../db/pool');

async function checkUserViolations(userId) {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [records] = await pool.query(
    'SELECT COUNT(*) as count FROM violation_records WHERE user_id = ? AND violation_month = ?',
    [userId, month]
  );
  return {
    count: records[0].count,
    month,
    isBanned: records[0].count >= 3
  };
}

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

function isTimeOverlap(start1, end1, start2, end2) {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  return s1 < e2 && s2 < e1;
}

function success(res, data = null, message = '操作成功') {
  res.json({ code: 0, message, data });
}

function fail(res, message = '操作失败', code = 1, status = 400) {
  res.status(status).json({ code, message });
}

module.exports = {
  checkUserViolations,
  timeToMinutes,
  minutesToTime,
  isTimeOverlap,
  success,
  fail
};
