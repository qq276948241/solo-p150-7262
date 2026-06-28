const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function initDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true
  });

  try {
    console.log('开始初始化数据库...');

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.query(`USE \`${process.env.DB_NAME}\``);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        real_name VARCHAR(50) NOT NULL,
        student_no VARCHAR(20) UNIQUE,
        role ENUM('student', 'admin') DEFAULT 'student',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS buildings (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(20) UNIQUE NOT NULL,
        description VARCHAR(255),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS study_rooms (
        id INT PRIMARY KEY AUTO_INCREMENT,
        building_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        room_no VARCHAR(20) NOT NULL,
        open_time TIME NOT NULL DEFAULT '08:00:00',
        close_time TIME NOT NULL DEFAULT '22:00:00',
        is_active TINYINT(1) DEFAULT 1,
        version INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS seats (
        id INT PRIMARY KEY AUTO_INCREMENT,
        room_id INT NOT NULL,
        seat_no VARCHAR(20) NOT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES study_rooms(id) ON DELETE CASCADE,
        UNIQUE KEY uk_room_seat (room_id, seat_no)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS reservations (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        seat_id INT NOT NULL,
        room_id INT NOT NULL,
        building_id INT NOT NULL,
        reserve_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        status ENUM('pending', 'confirmed', 'cancelled', 'violated') DEFAULT 'confirmed',
        version INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (seat_id) REFERENCES seats(id) ON DELETE CASCADE,
        FOREIGN KEY (room_id) REFERENCES study_rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE,
        INDEX idx_seat_date (seat_id, reserve_date),
        INDEX idx_user_date (user_id, reserve_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS violation_records (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        reservation_id INT NOT NULL,
        violation_month VARCHAR(7) NOT NULL,
        reason VARCHAR(255),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
        INDEX idx_user_month (user_id, violation_month)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const adminPassword = await bcrypt.hash('admin123', 10);
    const studentPassword = await bcrypt.hash('123456', 10);

    await connection.query(`
      INSERT IGNORE INTO users (username, password, real_name, student_no, role) VALUES
      ('admin', ?, '系统管理员', NULL, 'admin'),
      ('student1', ?, '张三', '2024001', 'student'),
      ('student2', ?, '李四', '2024002', 'student')
    `, [adminPassword, studentPassword, studentPassword]);

    const [buildingResult] = await connection.query(`
      INSERT IGNORE INTO buildings (name, code, description) VALUES
      ('第一教学楼', 'BLDG1', '主教学楼'),
      ('图书馆', 'BLDG2', '校图书馆'),
      ('第二教学楼', 'BLDG3', '新教学楼')
    `);

    const [buildings] = await connection.query('SELECT id FROM buildings ORDER BY id');
    if (buildings.length > 0) {
      for (let i = 0; i < buildings.length; i++) {
        const buildingId = buildings[i].id;
        const roomCount = i === 1 ? 3 : 2;
        for (let j = 1; j <= roomCount; j++) {
          const [roomResult] = await connection.query(`
            INSERT IGNORE INTO study_rooms (building_id, name, room_no, open_time, close_time) VALUES
            (?, ?, ?, '08:00:00', '22:00:00')
          `, [buildingId, `${['第一教学楼', '图书馆', '第二教学楼'][i]}${j}号自习室`, `${String.fromCharCode(65 + i)}${100 + j}`]);

          const [rooms] = await connection.query('SELECT id FROM study_rooms WHERE building_id = ? ORDER BY id DESC LIMIT 1', [buildingId]);
          if (rooms.length > 0) {
            const roomId = rooms[0].id;
            const seatValues = [];
            for (let k = 1; k <= 20; k++) {
              seatValues.push([roomId, `S${String(k).padStart(2, '0')}`]);
            }
            await connection.query(`
              INSERT IGNORE INTO seats (room_id, seat_no) VALUES ?
            `, [seatValues]);
          }
        }
      }
    }

    console.log('数据库初始化完成！');
    console.log('默认账号：admin / admin123 (管理员)');
    console.log('默认账号：student1 / 123456 (学生)');
    console.log('默认账号：student2 / 123456 (学生)');
  } catch (error) {
    console.error('数据库初始化失败:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

initDatabase().catch(console.error);
