import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录' }
  },
  {
    path: '/',
    component: () => import('@/layout/MainLayout.vue'),
    redirect: '/reserve',
    children: [
      {
        path: 'reserve',
        name: 'Reserve',
        component: () => import('@/views/Reserve.vue'),
        meta: { title: '预约自习室', requiresAuth: true }
      },
      {
        path: 'my-reservations',
        name: 'MyReservations',
        component: () => import('@/views/MyReservations.vue'),
        meta: { title: '我的预约', requiresAuth: true }
      },
      {
        path: 'admin',
        name: 'Admin',
        component: () => import('@/views/admin/Dashboard.vue'),
        meta: { title: '管理后台', requiresAuth: true, requiresAdmin: true }
      },
      {
        path: 'admin/rooms',
        name: 'AdminRooms',
        component: () => import('@/views/admin/Rooms.vue'),
        meta: { title: '自习室管理', requiresAuth: true, requiresAdmin: true }
      },
      {
        path: 'admin/violations',
        name: 'AdminViolations',
        component: () => import('@/views/admin/Violations.vue'),
        meta: { title: '违约名单', requiresAuth: true, requiresAdmin: true }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/reserve'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  document.title = to.meta.title ? `${to.meta.title} - 校园自习室预约系统` : '校园自习室预约系统'

  const token = localStorage.getItem('token')
  const userInfo = JSON.parse(localStorage.getItem('userInfo') || 'null')

  if (to.meta.requiresAuth) {
    if (!token) {
      next('/login')
    } else if (to.meta.requiresAdmin && userInfo?.role !== 'admin') {
      next('/reserve')
    } else {
      next()
    }
  } else if (to.path === '/login' && token) {
    next('/reserve')
  } else {
    next()
  }
})

export default router
