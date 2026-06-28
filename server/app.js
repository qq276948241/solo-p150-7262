require('dotenv').config();
const express = require('express');
const cors = require('cors');

const userRoutes = require('./routes/user');
const roomRoutes = require('./routes/room');
const reservationRoutes = require('./routes/reservation');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ code: 0, message: 'ok', data: { status: 'running' } });
});

app.use('/api/user', userRoutes);
app.use('/api/room', roomRoutes);
app.use('/api/reservation', reservationRoutes);
app.use('/api/admin', adminRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ code: 500, message: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 自习室预约系统后端服务已启动`);
  console.log(`📌 服务地址: http://localhost:${PORT}`);
  console.log(`📡 健康检查: http://localhost:${PORT}/api/health\n`);
});
