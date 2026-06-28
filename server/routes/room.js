const express = require('express');
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const { success, fail, isTimeOverlap } = require('../utils/common');

const router = express.Router();

router.get('/buildings', authMiddleware, async (req, res) => {
  try {
    const [buildings] = await pool.query('SELECT * FROM buildings ORDER BY id');
    success(res, buildings);
  } catch (error) {
    console.error('获取楼栋列表错误:', error);
    fail(res, '获取失败');
  }
});

router.get('/rooms', authMiddleware, async (req, res) => {
  try {
    const { building_id } = req.query;
    let sql = `
      SELECT sr.*, b.name as building_name 
      FROM study_rooms sr 
      LEFT JOIN buildings b ON sr.building_id = b.id 
      WHERE sr.is_active = 1
    `;
    const params = [];
    if (building_id) {
      sql += ' AND sr.building_id = ?';
      params.push(building_id);
    }
    sql += ' ORDER BY sr.id';
    const [rooms] = await pool.query(sql, params);
    success(res, rooms);
  } catch (error) {
    console.error('获取自习室列表错误:', error);
    fail(res, '获取失败');
  }
});

router.get('/rooms/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const [rooms] = await pool.query(`
      SELECT sr.*, b.name as building_name 
      FROM study_rooms sr 
      LEFT JOIN buildings b ON sr.building_id = b.id 
      WHERE sr.id = ?
    `, [id]);
    if (rooms.length === 0) {
      return fail(res, '自习室不存在');
    }
    success(res, rooms[0]);
  } catch (error) {
    console.error('获取自习室详情错误:', error);
    fail(res, '获取失败');
  }
});

router.get('/seats', authMiddleware, async (req, res) => {
  try {
    const { room_id, date, start_time, end_time } = req.query;
    if (!room_id) {
      return fail(res, '请选择自习室');
    }

    const [seats] = await pool.query(`
      SELECT s.*, sr.room_no, sr.name as room_name, sr.open_time, sr.close_time, b.name as building_name
      FROM seats s
      LEFT JOIN study_rooms sr ON s.room_id = sr.id
      LEFT JOIN buildings b ON sr.building_id = b.id
      WHERE s.room_id = ? AND s.is_active = 1
      ORDER BY s.seat_no
    `, [room_id]);

    let reservedSeatIds = new Set();
    if (date && start_time && end_time) {
      const [reservations] = await pool.query(`
        SELECT seat_id, start_time, end_time 
        FROM reservations 
        WHERE room_id = ? AND reserve_date = ? AND status IN ('confirmed', 'pending')
      `, [room_id, date]);

      for (const r of reservations) {
        if (isTimeOverlap(start_time, end_time, r.start_time, r.end_time)) {
          reservedSeatIds.add(r.seat_id);
        }
      }
    }

    const seatsWithStatus = seats.map(seat => ({
      ...seat,
      is_reserved: reservedSeatIds.has(seat.id),
      status: seat.is_active ? (reservedSeatIds.has(seat.id) ? 'reserved' : 'available') : 'disabled'
    }));

    success(res, seatsWithStatus);
  } catch (error) {
    console.error('获取座位列表错误:', error);
    fail(res, '获取失败');
  }
});

router.get('/occupied-times', authMiddleware, async (req, res) => {
  try {
    const { room_id, date } = req.query;
    if (!room_id || !date) {
      return fail(res, '缺少必要参数');
    }

    const [reservations] = await pool.query(`
      SELECT seat_id, seat_no, start_time, end_time 
      FROM reservations r
      LEFT JOIN seats s ON r.seat_id = s.id
      WHERE r.room_id = ? AND r.reserve_date = ? AND r.status IN ('confirmed', 'pending')
      ORDER BY s.seat_no, r.start_time
    `, [room_id, date]);

    success(res, reservations);
  } catch (error) {
    console.error('获取占用时段错误:', error);
    fail(res, '获取失败');
  }
});

module.exports = router;
