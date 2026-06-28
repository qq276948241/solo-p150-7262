const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '未登录，请先登录' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [users] = await pool.query('SELECT id, username, real_name, student_no, role FROM users WHERE id = ?', [decoded.id]);
    if (users.length === 0) {
      return res.status(401).json({ code: 401, message: '用户不存在' });
    }
    req.user = users[0];
    next();
  } catch (error) {
    return res.status(401).json({ code: 401, message: '登录已过期，请重新登录' });
  }
}

async function adminMiddleware(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ code: 403, message: '无权限访问' });
  }
  next();
}

module.exports = { generateToken, authMiddleware, adminMiddleware };
