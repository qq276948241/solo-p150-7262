# 校园自习室预约系统 — 架构说明

> 本文档像聊天一样给你捋明白这项目是怎么跑起来的，看完别忘自己动手跑一遍，代码里的注释也挺多的。

---

## 🗂️ 先看全貌：目录结构

```
project150/
├── server/                     # 后端 Node.js + Express + MySQL
│   ├── app.js                  # 【入口】请求从这进来
│   ├── .env                    # 数据库、JWT 密钥等配置
│   ├── db/
│   │   ├── pool.js             # MySQL 连接池
│   │   └── init.js             # 建表+初始化数据脚本
│   ├── middleware/
│   │   └── auth.js             # JWT 认证中间件（重点！）
│   ├── utils/
│   │   └── common.js           # 工具函数（时间计算、违约检查、统一响应）
│   └── routes/                 # 4 组路由，业务逻辑全在这
│       ├── user.js             # 登录/注册
│       ├── room.js             # 楼栋/自习室/座位查询
│       ├── reservation.js      # 预约创建/查询/取消（含乐观锁！）
│       └── admin.js            # 管理后台
│
└── web/                        # 前端 Vue3 + Vite + Element Plus
    ├── index.html
    ├── vite.config.js          # 代理配置：/api → localhost:3000
    └── src/
        ├── main.js             # 【入口】应用从这启动
        ├── App.vue
        ├── router/index.js     # 路由 + 全局守卫
        ├── stores/user.js      # Pinia 状态管理（用户信息）
        ├── composables/
        │   └── useRoomFilter.js # 自习室筛选逻辑（刚抽的 composable）
        ├── api/                # Axios 封装，按业务模块分
        │   ├── user.js
        │   ├── room.js
        │   ├── reservation.js
        │   └── admin.js
        ├── utils/request.js    # Axios 拦截器（自动带 token、401 跳登录）
        ├── layout/
        │   └── MainLayout.vue  # 侧边栏 + 顶栏主布局
        └── views/              # 页面组件
            ├── Login.vue
            ├── Reserve.vue
            ├── MyReservations.vue
            └── admin/
                ├── Dashboard.vue
                ├── Rooms.vue
                └── Violations.vue
```

---

## 🚰 后端请求流动线：从 app.js 到数据库

咱们顺着一个请求的生命周期捋：

### 第 1 步：进入 [app.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo150/project150/server/app.js)
`app.js` 是 Express 应用的入口，干的事一目了然：
1. 加载 `.env` 配置
2. 注册中间件：`cors`（跨域）→ `express.json()`（解析 body）
3. 注册路由：
   ```
   /api/user        → userRoutes
   /api/room        → roomRoutes
   /api/reservation → reservationRoutes
   /api/admin       → adminRoutes
   ```
4. 最后挂一个全局错误处理器（兜底用的）
5. 监听 3000 端口

### 第 2 步：进入某个路由文件（以预约为例）
请求到了 [routes/reservation.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo150/project150/server/routes/reservation.js)，每个路由基本长这样：
```js
router.post('/', authMiddleware, async (req, res) => {
  // ...业务逻辑
})
```
看到没？第二个参数就是认证中间件 `authMiddleware`，**请求先过它这关才能进业务逻辑**。

### 第 3 步：业务逻辑里调用数据库
业务逻辑通过 `pool` 连接池执行 SQL，拿数据、做判断、返回结果。

```
请求 → app.js → 路由匹配 → authMiddleware → 业务handler → pool.query() → 返回JSON
```

---

## 🔐 认证中间件怎么验证 token？

在 [middleware/auth.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo150/project150/server/middleware/auth.js) 里，`authMiddleware` 是个典型的"门卫"角色，干 4 件事：

1. **取 token**：从请求头 `Authorization: Bearer xxx` 里抠出 token，没有直接返回 401
2. **验 token**：用 `jwt.verify(token, JWT_SECRET)` 验签名，过期/伪造直接 401
3. **查用户**：从解码后的 payload 拿 `id`，去数据库查这条用户还在不在（防止用户被删了但 token 还在）
4. **挂用户**：把查到的用户对象挂到 `req.user` 上，后面业务 handler 直接用 `req.user.id` 就行，不用再查了
5. **放行**：调用 `next()` 进入业务逻辑

> 💡 小细节：登录成功时 `generateToken()` 会把 `{id, username, role}` 塞进 token 的 payload，这样解码后就能知道用户是谁、是不是管理员。

`adminMiddleware` 更简单：就看 `req.user.role` 是不是 `'admin'`，不是就返回 403。

---

## 🔒 乐观锁防并发抢座怎么落地的？

这个是核心业务，在 [routes/reservation.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo150/project150/server/routes/reservation.js#L56-L174) 的 `POST /` 接口里。

核心思路是 **数据库事务 + 行级锁**，用 MySQL 的 `SELECT ... FOR UPDATE` 在事务里把该行锁住，防止两个请求同时读到"空座"然后都插进去。

具体步骤（对照代码看更清楚）：
1. 从连接池拿一个连接，`beginTransaction()` 开启事务
2. 先查违约次数，≥3 次直接回滚拒绝
3. 一堆参数校验（时长30-120分钟、在开放时间内、没选过去的日期等等）
4. **关键一步**：
   ```sql
   SELECT id, start_time, end_time FROM reservations 
   WHERE seat_id = ? AND reserve_date = ? AND status IN ('confirmed', 'pending')
   FOR UPDATE  -- 👈 这句就是锁！其他事务再查同一条会等我完事
   ```
5. 遍历这些结果，用 `isTimeOverlap()` 算时间有没有重叠，重叠就回滚返回 409
6. 同样查一下用户本人当天有没有时段冲突（不能同时约俩座位）
7. 校验都过了就 `INSERT` 一条预约记录
8. `commit()` 提交事务，锁自动释放
9. 要是 catch 到 `ER_LOCK_DEADLOCK` 死锁或者 `ER_LOCK_WAIT_TIMEOUT` 锁超时，说明真撞车了，返回 409 让用户重试

> 💡 为啥叫"乐观锁"？其实这套实现是**悲观锁**（`FOR UPDATE` 先锁再查），但表里有个 `version` 字段是给乐观锁留的口子（更新时 `WHERE version = ?`），相当于两套方案都布了。实际跑起来悲观锁更可靠，毕竟抢座这种场景冲突概率不低。

---

## ⚠️ 违约累计逻辑散在哪？

这个业务逻辑稍微有点散，我给你把文件串起来：

### ① 违约检查工具函数：[utils/common.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo150/project150/server/utils/common.js)
`checkUserViolations(userId)` 函数：查 `violation_records` 表，按当月统计违约次数，≥3 就标记 `isBanned: true`。
- 预约前调一次拦着不让约
- 前端页面也调一次显示红色警告条

### ② 违约产生的地方：[routes/reservation.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo150/project150/server/routes/reservation.js#L176-L240) 的取消接口
取消预约时拿当前时间和"预约开始前15分钟"那个时间点比：
- 距开始 > 15 分钟取消 → 正常取消，不记违约
- 距开始 ≤ 15 分钟取消 → `isViolation = true`，预约状态改成 `'violated'`，插一条违约记录
- 已过预约时间取消 → 同上，算违约

违约记录的 `violation_month` 字段格式是 `'2024-06'`，方便按月统计。

### ③ 违约名单展示：[routes/admin.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo150/project150/server/routes/admin.js#L220-L270)
管理后台的 `/admin/violations` 接口：
- 按月份查所有违约记录
- 顺便 GROUP BY 出本月违约 ≥3 次的禁约名单

一句话总结：**违约检查在 common.js，违约产生在取消接口，违约展示在 admin.js**，数据都落 `violation_records` 表。

---

## 🖥️ 前端启动流程：main.js 干了啥

打开 [web/src/main.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo150/project150/web/src/main.js)，顺序很重要：

1. `createApp(App)` 创建 Vue 应用实例
2. 全局注册所有 Element Plus 图标（省事，不用每个页面单独 import）
3. `use(createPinia())` 装 Pinia 状态管理
4. `use(router)` 装路由
5. `use(ElementPlus, { locale: zhCn })` 装 Element Plus 组件库（中文语言包）
6. `mount('#app')` 挂到 `index.html` 的 `#app` 节点上

就这 6 步，应用就跑起来了。

---

## 🧩 前端模块怎么串起来的？

一张图画明白：

```
用户点按钮
    ↓
views/XXX.vue （页面组件，管渲染和交互）
    ↓ 调用
stores/xxx.js 或 api/xxx.js （状态/接口）
    ↓ 调用
utils/request.js （Axios 实例，自动带 token）
    ↓ 发请求
Vite 代理 /api → localhost:3000
    ↓
后端响应 → 更新 data → 页面刷新
```

拆开说每个模块的职责：

### 👉 [utils/request.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo150/project150/web/src/utils/request.js) — Axios 封装
- 请求拦截器：从 localStorage 取 token，自动塞进 `Authorization` 头
- 响应拦截器：后端返回 `code !== 0` 就弹错误提示，`code === 401` 自动清 token 跳登录页
- 所有 API 调用都走它，不用每个地方写一遍拦截逻辑

### 👉 [api/](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo150/project150/web/src/api/) 目录
按后端路由模块分文件，每个文件就是一堆函数，比如 `api/room.js`：
```js
export function getSeats(params) {
  return request({ url: '/room/seats', method: 'get', params })
}
```
页面里 `import { getSeats } from '@/api/room'` 直接调，不用写 URL。

### 👉 [stores/user.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo150/project150/web/src/stores/user.js) — Pinia 状态管理
只存用户相关的：`token`、`userInfo`、`isLoggedIn`、`isAdmin` 这些。登录/注册/登出三个 action，顺便同步到 localStorage。

### 👉 [router/index.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo150/project150/web/src/router/index.js) — 路由 + 全局守卫
`beforeEach` 钩子干三件事：
1. 改文档标题
2. 要登录的路由（`meta.requiresAuth: true`）检查 token，没有就跳 `/login`
3. 要管理员的路由（`meta.requiresAdmin: true`）再检查 `role`，不是就跳首页

### 👉 [composables/](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo150/project150/web/src/composables/) — 可复用逻辑
比如刚抽的 `useRoomFilter.js`，把"加载楼栋+加载自习室+按楼栋/关键词筛选"这一坨逻辑打包成一个函数，页面里一行 `const { ... } = useRoomFilter()` 就完事，符合 Vue3 组合式 API 的玩法。

### 👉 [views/](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo150/project150/web/src/views/) — 页面组件
理想状态下，页面组件只干两件事：
1. 把数据渲染到模板上
2. 把用户交互转发给 api 或 stores

别在页面里写几百行业务逻辑，往 composables 或 api 里抽。

---

## 🔄 走一遍完整流程：用户点"确认预约"发生了啥？

从前端到后端走一遍你就全懂了：

1. **用户在 [Reserve.vue](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo150/project150/web/src/views/Reserve.vue) 选好座位点提交**
2. **前端调 `createReservation(data)`** → 走 `request.js` 自动带上 token → 发 `POST /api/reservation`
3. **后端 `app.js` 匹配到路由** → 先过 `authMiddleware` 验 token → 把用户挂到 `req.user`
4. **进预约 handler** → 开事务 → 查违约 → 各种校验 → `SELECT ... FOR UPDATE` 锁座位 → 查冲突 → 插记录 → 提交事务
5. **返回 `{ code: 0, data: 新预约 }`**
6. **前端 `request.js` 响应拦截器** 看到 code=0，把 `data` 解出来返回
7. **页面弹成功提示** → 刷新座位列表 → 新预约的座位显示"已占用"

---

## 💡 给新人的上手建议

1. **先跑起来再说**：按 README 步骤，先 init-db 建表，再启后端，再启前端，用默认账号登进去点一圈，比光看代码明白 10 倍
2. **从一个接口往里刨**：比如就盯着"预约"这个核心接口，从前端按钮一路追到数据库，整个数据流就通了
3. ** composable 是个好东西**：页面里一坨一坨的状态+逻辑，看不顺眼就抽成 composable，文件名就叫 `useXXX.js`，页面瞬间清爽
4. **改数据库字段记得同步改初始化脚本**：`db/init.js` 是新人第一次跑项目时建表用的，别光改线上表忘了更脚本

有啥看不懂的，直接搜对应文件名定位过去，代码里都有注释，顺着数据流一步步捋就完事。
