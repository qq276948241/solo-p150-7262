const express = require('express');
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const { success, fail, timeToMinutes, isTimeOverlap, checkUserViolations } = require('../utils/common');

const router = express.Router();

router.get('/my', authMiddleware, async (req, res) => {
  try {
    const { status } = req.query;
    let sql = `
      SELECT r.*, s.seat_no, sr.room_no, sr.name as room_name, b.name as building_name
      FROM reservations r
      LEFT JOIN seats s ON r.seat_id = s.id
      LEFT JOIN study_rooms sr ON r.room_id = sr.id
      LEFT JOIN buildings b ON r.building_id = b.id
      WHERE r.user_id = ?
    `;
    const params = [req.user.id];
    if (status) {
      sql += ' AND r.status = ?';
      params.push(status);
    }
    sql += ' ORDER BY r.reserve_date DESC, r.start_time DESC';

    const [reservations] = await pool.query(sql, params);

    const now = new Date();
    const formatted = reservations.map(r => {
      const reserveDateTime = new Date(`${r.reserve_date}T${r.start_time}`);
      const fifteenMinutesBefore = new Date(reserveDateTime.getTime() - 15 * 60 * 1000);
      return {
        ...r,
        can_cancel: r.status === 'confirmed' && now < fifteenMinutesBefore,
        cancel_deadline: fifteenMinutesBefore
      };
    });

    success(res, formatted);
  } catch (error) {
    console.error('获取我的预约错误:', error);
    fail(res, '获取失败');
  }
});

router.get('/violation-status', authMiddleware, async (req, res) => {
  try {
    const status = await checkUserViolations(req.user.id);
    success(res, status);
  } catch (error) {
    console.error('获取违约状态错误:', error);
    fail(res, '获取失败');
  }
});

router.post('/', authMiddleware, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const violation = await checkUserViolations(req.user.id);
    if (violation.isBanned) {
      await connection.rollback();
      return fail(res, `本月违约${violation.count}次，已被禁止预约，下月恢复`, 403);
    }

    const { seat_id, room_id, building_id, reserve_date, start_time, end_time } = req.body;
    if (!seat_id || !room_id || !building_id || !reserve_date || !start_time || !end_time) {
      await connection.rollback();
      return fail(res, '请填写完整预约信息');
    }

    const startMin = timeToMinutes(start_time);
    const endMin = timeToMinutes(end_time);
    if (endMin <= startMin) {
      await connection.rollback();
      return fail(res, '结束时间必须晚于开始时间');
    }
    const duration = endMin - startMin;
    if (duration > 120) {
      await connection.rollback();
      return fail(res, '单次预约最长2小时');
    }
    if (duration < 30) {
      await connection.rollback();
      return fail(res, '单次预约至少30分钟');
    }

    const [rooms] = await connection.query(
      'SELECT open_time, close_time FROM study_rooms WHERE id = ? AND is_active = 1',
      [room_id]
    );
    if (rooms.length === 0) {
      await connection.rollback();
      return fail(res, '自习室不存在或已关闭');
    }
    const room = rooms[0];
    const openMin = timeToMinutes(room.open_time);
    const closeMin = timeToMinutes(room.close_time);
    if (startMin < openMin || endMin > closeMin) {
      await connection.rollback();
      return fail(res, `预约时间必须在开放时间 ${room.open_time} - ${room.close_time} 内`);
    }

    const today = new Date().toISOString().split('T')[0];
    const reserveDateStr = new Date(reserve_date).toISOString().split('T')[0];
    if (reserveDateStr < today) {
      await connection.rollback();
      return fail(res, '不能预约过去的日期');
    }

    const [seats] = await connection.query(
      'SELECT id FROM seats WHERE id = ? AND room_id = ? AND is_active = 1',
      [seat_id, room_id]
    );
    if (seats.length === 0) {
      await connection.rollback();
      return fail(res, '座位不存在或已停用');
    }

    const [conflicts] = await connection.query(`
      SELECT id, version FROM reservations 
      WHERE seat_id = ? AND reserve_date = ? AND status IN ('confirmed', 'pending')
      FOR UPDATE
    `, [seat_id, reserve_date]);

    for (const c of conflicts) {
      if (isTimeOverlap(start_time, end_time, c.start_time, c.end_time)) {
        await connection.rollback();
        return fail(res, '该座位该时段已被预约', 409);
      }
    }

    const [userConflicts] = await connection.query(`
      SELECT * FROM reservations 
      WHERE user_id = ? AND reserve_date = ? AND status IN ('confirmed', 'pending')
    `, [req.user.id, reserve_date]);

    for (const c of userConflicts) {
      if (isTimeOverlap(start_time, end_time, c.start_time, c.end_time)) {
        await connection.rollback();
        return fail(res, '您在该时段已有其他预约', 409);
      }
    }

    const [result] = await connection.query(`
      INSERT INTO reservations (user_id, seat_id, room_id, building_id, reserve_date, start_time, end_time, status, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed', 0)
    `, [req.user.id, seat_id, room_id, building_id, reserve_date, start_time, end_time]);

    await connection.commit();

    const [newReservations] = await pool.query(`
      SELECT r.*, s.seat_no, sr.room_no, sr.name as room_name, b.name as building_name
      FROM reservations r
      LEFT JOIN seats s ON r.seat_id = s.id
      LEFT JOIN study_rooms sr ON r.room_id = sr.id
      LEFT JOIN buildings b ON r.building_id = b.id
      WHERE r.id = ?
    `, [result.insertId]);

    success(res, newReservations[0], '预约成功');
  } catch (error) {
    await connection.rollback();
    console.error('创建预约错误:', error);
    if (error.code === 'ER_LOCK_DEADLOCK' || error.code === 'ER_LOCK_WAIT_TIMEOUT') {
      fail(res, '预约冲突，请稍后重试', 409);
    } else {
      fail(res, '预约失败');
    }
  } finally {
    connection.release();
  }
});

router.post('/:id/cancel', authMiddleware, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const [reservations] = await connection.query(
      'SELECT * FROM reservations WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (reservations.length === 0) {
      await connection.rollback();
      return fail(res, '预约不存在');
    }

    const reservation = reservations[0];
    if (reservation.status !== 'confirmed') {
      await connection.rollback();
      return fail(res, '该预约无法取消');
    }

    const now = new Date();
    const reserveDateTime = new Date(`${reservation.reserve_date}T${reservation.start_time}`);
    const fifteenMinutesBefore = new Date(reserveDateTime.getTime() - 15 * 60 * 1000);

    let isViolation = false;
    let newStatus = 'cancelled';

    if (now >= fifteenMinutesBefore && now < reserveDateTime) {
      isViolation = true;
      newStatus = 'violated';
    }

    if (now >= reserveDateTime) {
      isViolation = true;
      newStatus = 'violated';
    }

    await connection.query(
      'UPDATE reservations SET status = ?, version = version + 1 WHERE id = ? AND version = ?',
      [newStatus, id, reservation.version]
    );

    if (isViolation) {
      const violationMonth = `${reservation.reserve_date.substring(0, 7)}`;
      await connection.query(`
        INSERT INTO violation_records (user_id, reservation_id, violation_month, reason)
        VALUES (?, ?, ?, ?)
      `, [req.user.id, id, violationMonth, '预约开始前15分钟内取消或未到']);
    }

    await connection.commit();

    const msg = isViolation
      ? '取消成功，因距开始不足15分钟，记违约1次'
      : '取消成功';

    success(res, { is_violation: isViolation }, msg);
  } catch (error) {
    await connection.rollback();
    console.error('取消预约错误:', error);
    fail(res, '取消失败');
  } finally {
    connection.release();
  }
});

module.exports = router;
