const express = require('express');
const pool = require('../db/pool');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { success, fail } = require('../utils/common');

const router = express.Router();

router.get('/buildings', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [buildings] = await pool.query(`
      SELECT b.*, COUNT(sr.id) as room_count
      FROM buildings b
      LEFT JOIN study_rooms sr ON b.id = sr.building_id
      GROUP BY b.id
      ORDER BY b.id
    `);
    success(res, buildings);
  } catch (error) {
    console.error('获取楼栋列表错误:', error);
    fail(res, '获取失败');
  }
});

router.post('/buildings', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, code, description } = req.body;
    if (!name || !code) {
      return fail(res, '请填写完整信息');
    }
    const [existing] = await pool.query('SELECT id FROM buildings WHERE code = ?', [code]);
    if (existing.length > 0) {
      return fail(res, '楼栋编码已存在');
    }
    const [result] = await pool.query(
      'INSERT INTO buildings (name, code, description) VALUES (?, ?, ?)',
      [name, code, description]
    );
    success(res, { id: result.insertId }, '添加成功');
  } catch (error) {
    console.error('添加楼栋错误:', error);
    fail(res, '添加失败');
  }
});

router.put('/buildings/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description } = req.body;
    await pool.query(
      'UPDATE buildings SET name = ?, code = ?, description = ? WHERE id = ?',
      [name, code, description, id]
    );
    success(res, null, '更新成功');
  } catch (error) {
    console.error('更新楼栋错误:', error);
    fail(res, '更新失败');
  }
});

router.delete('/buildings/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM buildings WHERE id = ?', [id]);
    success(res, null, '删除成功');
  } catch (error) {
    console.error('删除楼栋错误:', error);
    fail(res, '删除失败');
  }
});

router.get('/rooms', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { building_id } = req.query;
    let sql = `
      SELECT sr.*, b.name as building_name, 
             (SELECT COUNT(*) FROM seats s WHERE s.room_id = sr.id) as seat_count
      FROM study_rooms sr
      LEFT JOIN buildings b ON sr.building_id = b.id
    `;
    const params = [];
    if (building_id) {
      sql += ' WHERE sr.building_id = ?';
      params.push(building_id);
    }
    sql += ' ORDER BY sr.id DESC';
    const [rooms] = await pool.query(sql, params);
    success(res, rooms);
  } catch (error) {
    console.error('获取自习室列表错误:', error);
    fail(res, '获取失败');
  }
});

router.post('/rooms', authMiddleware, adminMiddleware, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { building_id, name, room_no, open_time, close_time, seat_count } = req.body;
    if (!building_id || !name || !room_no || !open_time || !close_time) {
      await connection.rollback();
      return fail(res, '请填写完整信息');
    }
    const count = seat_count || 20;

    const [result] = await connection.query(`
      INSERT INTO study_rooms (building_id, name, room_no, open_time, close_time)
      VALUES (?, ?, ?, ?, ?)
    `, [building_id, name, room_no, open_time, close_time]);

    const seatValues = [];
    for (let i = 1; i <= count; i++) {
      seatValues.push([result.insertId, `S${String(i).padStart(2, '0')}`]);
    }
    await connection.query('INSERT INTO seats (room_id, seat_no) VALUES ?', [seatValues]);

    await connection.commit();
    success(res, { id: result.insertId }, '添加成功');
  } catch (error) {
    await connection.rollback();
    console.error('添加自习室错误:', error);
    fail(res, '添加失败');
  } finally {
    connection.release();
  }
});

router.put('/rooms/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { building_id, name, room_no, open_time, close_time, is_active } = req.body;
    await pool.query(`
      UPDATE study_rooms SET building_id = ?, name = ?, room_no = ?, open_time = ?, close_time = ?, is_active = ?
      WHERE id = ?
    `, [building_id, name, room_no, open_time, close_time, is_active, id]);
    success(res, null, '更新成功');
  } catch (error) {
    console.error('更新自习室错误:', error);
    fail(res, '更新失败');
  }
});

router.delete('/rooms/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE study_rooms SET is_active = 0 WHERE id = ?', [id]);
    success(res, null, '已停用');
  } catch (error) {
    console.error('删除自习室错误:', error);
    fail(res, '操作失败');
  }
});

router.get('/violations', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { month } = req.query;
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const queryMonth = month || defaultMonth;

    const [records] = await pool.query(`
      SELECT 
        vr.id,
        vr.user_id,
        u.username,
        u.real_name,
        u.student_no,
        vr.reservation_id,
        vr.violation_month,
        vr.reason,
        vr.created_at,
        (
          SELECT COUNT(*) FROM violation_records vr2 
          WHERE vr2.user_id = vr.user_id AND vr2.violation_month = vr.violation_month
        ) as month_count
      FROM violation_records vr
      LEFT JOIN users u ON vr.user_id = u.id
      WHERE vr.violation_month = ?
      ORDER BY vr.created_at DESC
    `, [queryMonth]);

    const [summary] = await pool.query(`
      SELECT 
        u.id as user_id,
        u.username,
        u.real_name,
        u.student_no,
        COUNT(*) as violation_count
      FROM violation_records vr
      LEFT JOIN users u ON vr.user_id = u.id
      WHERE vr.violation_month = ?
      GROUP BY u.id
      HAVING violation_count >= 3
      ORDER BY violation_count DESC
    `, [queryMonth]);

    success(res, {
      month: queryMonth,
      records,
      banned_list: summary
    });
  } catch (error) {
    console.error('获取违约名单错误:', error);
    fail(res, '获取失败');
  }
});

router.get('/statistics', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [totalUsers] = await pool.query("SELECT COUNT(*) as count FROM users WHERE role = 'student'");
    const [totalRooms] = await pool.query('SELECT COUNT(*) as count FROM study_rooms WHERE is_active = 1');
    const [totalSeats] = await pool.query('SELECT COUNT(*) as count FROM seats WHERE is_active = 1');
    const [todayReservations] = await pool.query(`
      SELECT COUNT(*) as count FROM reservations WHERE reserve_date = CURDATE() AND status = 'confirmed'
    `);

    success(res, {
      total_users: totalUsers[0].count,
      total_rooms: totalRooms[0].count,
      total_seats: totalSeats[0].count,
      today_reservations: todayReservations[0].count
    });
  } catch (error) {
    console.error('获取统计数据错误:', error);
    fail(res, '获取失败');
  }
});

module.exports = router;
