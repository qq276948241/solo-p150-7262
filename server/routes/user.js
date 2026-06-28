const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { generateToken, authMiddleware } = require('../middleware/auth');
const { success, fail } = require('../utils/common');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return fail(res, '用户名和密码不能为空');
    }

    const [users] = await pool.query(
      'SELECT id, username, password, real_name, student_no, role FROM users WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      return fail(res, '用户名或密码错误');
    }

    const user = users[0];
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return fail(res, '用户名或密码错误');
    }

    const token = generateToken(user);
    delete user.password;

    success(res, { token, user }, '登录成功');
  } catch (error) {
    console.error('登录错误:', error);
    fail(res, '登录失败');
  }
});

router.post('/register', async (req, res) => {
  try {
    const { username, password, real_name, student_no } = req.body;
    if (!username || !password || !real_name || !student_no) {
      return fail(res, '请填写完整信息');
    }

    const [existing] = await pool.query(
      'SELECT id FROM users WHERE username = ? OR student_no = ?',
      [username, student_no]
    );
    if (existing.length > 0) {
      return fail(res, '用户名或学号已存在');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (username, password, real_name, student_no, role) VALUES (?, ?, ?, ?, ?)',
      [username, hashedPassword, real_name, student_no, 'student']
    );

    const [newUsers] = await pool.query(
      'SELECT id, username, real_name, student_no, role FROM users WHERE id = ?',
      [result.insertId]
    );

    const token = generateToken(newUsers[0]);
    success(res, { token, user: newUsers[0] }, '注册成功');
  } catch (error) {
    console.error('注册错误:', error);
    fail(res, '注册失败');
  }
});

router.get('/info', authMiddleware, async (req, res) => {
  try {
    success(res, req.user, '获取成功');
  } catch (error) {
    console.error('获取用户信息错误:', error);
    fail(res, '获取失败');
  }
});

module.exports = router;
