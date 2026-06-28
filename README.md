# 校园自习室预约系统

基于 **Node.js + Express + MySQL** 后端，**Vue3 组合式 API + Vite + Element Plus** 前端的全栈校园自习室预约系统。

---

## 功能特性

### 学生端
- **登录/注册**：学生账号注册登录，支持 JWT 鉴权
- **预约页**：选择楼栋 → 自习室 → 日期 → 时段 → 座位，提交预约
  - 单次预约最长 2 小时，最少 30 分钟
  - 同一座位同一时段只能一人预约
  - 时间冲突自动拦截（座位冲突 + 本人时段冲突）
  - 预约接口使用乐观锁 + `SELECT ... FOR UPDATE` 防并发抢座
- **我的预约**：查看所有预约记录，支持取消
  - 开始前 15 分钟以上取消：不记违约
  - 开始前 15 分钟内取消或未到：记违约 1 次
  - 违约 3 次本月禁约，下月自动恢复

### 管理后台
- **数据概览**：学生数、自习室数、座位数、今日预约数
- **自习室管理**：新增/编辑/停用自习室，调整开放时段
- **违约名单**：按月份查看违约记录，展示本月禁约名单（违约≥3次）

---

## 项目结构

```
project150/
├── server/                 # 后端 Node.js + Express + MySQL
│   ├── app.js              # 入口文件
│   ├── package.json
│   ├── .env                # 环境配置
│   ├── db/
│   │   ├── pool.js         # MySQL 连接池
│   │   └── init.js         # 数据库初始化脚本
│   ├── middleware/
│   │   └── auth.js         # JWT 认证中间件
│   ├── utils/
│   │   └── common.js       # 工具函数
│   └── routes/
│       ├── user.js         # 用户登录/注册
│       ├── room.js         # 楼栋/自习室/座位查询
│       ├── reservation.js  # 预约创建/查询/取消
│       └── admin.js        # 管理后台接口
│
└── web/                    # 前端 Vue3 + Vite + Element Plus
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.js
        ├── App.vue
        ├── router/         # 路由配置 + 守卫
        ├── stores/         # Pinia 状态管理
        ├── api/            # Axios API 封装
        ├── utils/          # 工具函数
        ├── styles/         # 全局样式
        ├── layout/         # 主布局
        └── views/
            ├── Login.vue           # 登录/注册页
            ├── Reserve.vue         # 预约页
            ├── MyReservations.vue  # 我的预约页
            └── admin/
                ├── Dashboard.vue   # 数据概览
                ├── Rooms.vue       # 自习室管理
                └── Violations.vue  # 违约名单
```

---

## 快速开始

### 环境要求
- Node.js ≥ 16
- MySQL ≥ 5.7

### 1. 配置数据库

修改 `server/.env` 中的数据库连接信息：

```
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=123456
DB_NAME=study_room
JWT_SECRET=study_room_secret_key_2024
JWT_EXPIRES_IN=7d
```

### 2. 初始化数据库

```bash
cd server
npm install
npm run init-db
```

初始化后默认账号：
- 管理员：`admin` / `admin123`
- 学生1：`student1` / `123456`
- 学生2：`student2` / `123456`

### 3. 启动后端

```bash
cd server
npm start
# 或开发模式
npm run dev
```

后端运行在 `http://localhost:3000`

### 4. 启动前端

```bash
cd web
npm install
npm run dev
```

前端运行在 `http://localhost:5173`，已配置代理 `/api` → `http://localhost:3000`

---

## 核心实现说明

### 乐观锁防并发抢座

预约创建接口使用 **数据库事务 + 行级锁 (`SELECT ... FOR UPDATE`)** 的组合方案：

1. 开启事务
2. 查询该座位当日所有有效预约并加锁 `FOR UPDATE`
3. 校验时间是否冲突
4. 校验用户本人是否时段冲突
5. 插入新预约记录
6. 提交事务

若发生死锁或锁等待超时，返回 409 提示用户重试。

### 违约累计逻辑

- `violation_records` 表按月份记录违约
- 预约取消时：若距开始时间不足 15 分钟，或已过预约时间，记违约 1 次
- 预约前校验：当月违约 ≥ 3 次，禁止预约

### 座位状态判断

前端将"座位静态状态"与"时间段占用状态"分离：
- `is_active`：座位是否启用
- `is_reserved`：所选时间段是否被占用
- 点击事件仅在 `available` 状态下有效，非可用状态通过 CSS `pointer-events` + 代码双重阻断

---

## 主要技术栈

| 层级 | 技术 |
|------|------|
| 后端框架 | Express 4.x |
| 数据库 | MySQL 5.7+ / mysql2 |
| 认证 | JWT (jsonwebtoken) |
| 密码加密 | bcryptjs |
| 前端框架 | Vue 3.3 + 组合式 API |
| 构建工具 | Vite 5.x |
| UI 组件库 | Element Plus 2.x |
| 状态管理 | Pinia 2.x |
| 路由 | Vue Router 4.x |
| HTTP 客户端 | Axios |
| 日期处理 | dayjs |
