<template>
  <el-container class="main-layout">
    <el-header class="layout-header">
      <div class="header-left">
        <el-icon class="header-logo"><Reading /></el-icon>
        <span class="header-title">校园自习室预约系统</span>
      </div>
      <div class="header-right">
        <el-dropdown @command="handleCommand">
          <div class="user-info">
            <el-avatar :size="32" class="user-avatar">
              {{ userStore.userInfo?.real_name?.[0] || 'U' }}
            </el-avatar>
            <span class="user-name">{{ userStore.userInfo?.real_name || '用户' }}</span>
            <el-tag :type="userStore.isAdmin ? 'danger' : 'success'" size="small" effect="light">
              {{ userStore.isAdmin ? '管理员' : '学生' }}
            </el-tag>
            <el-icon><ArrowDown /></el-icon>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item divided command="logout">
                <el-icon><SwitchButton /></el-icon>退出登录
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </el-header>

    <el-container>
      <el-aside width="220px" class="layout-aside">
        <el-menu
          :default-active="$route.path"
          router
          class="side-menu"
          background-color="#001529"
          text-color="#c9d1d9"
          active-text-color="#ffffff"
        >
          <el-menu-item index="/reserve">
            <el-icon><Calendar /></el-icon>
            <span>预约自习室</span>
          </el-menu-item>
          <el-menu-item index="/my-reservations">
            <el-icon><Tickets /></el-icon>
            <span>我的预约</span>
          </el-menu-item>
          <template v-if="userStore.isAdmin">
            <el-sub-menu index="admin-group">
              <template #title>
                <el-icon><Setting /></el-icon>
                <span>管理后台</span>
              </template>
              <el-menu-item index="/admin">
                <el-icon><DataLine /></el-icon>
                <span>数据概览</span>
              </el-menu-item>
              <el-menu-item index="/admin/rooms">
                <el-icon><OfficeBuilding /></el-icon>
                <span>自习室管理</span>
              </el-menu-item>
              <el-menu-item index="/admin/violations">
                <el-icon><Warning /></el-icon>
                <span>违约名单</span>
              </el-menu-item>
            </el-sub-menu>
          </template>
        </el-menu>
      </el-aside>

      <el-main class="layout-main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Reading, ArrowDown, SwitchButton, Calendar, Tickets, Setting, DataLine, OfficeBuilding, Warning } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

async function handleCommand(command) {
  if (command === 'logout') {
    try {
      await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
      userStore.logout()
      ElMessage.success('已退出登录')
      router.push('/login')
    } catch (e) {
      // 取消
    }
  }
}
</script>

<style scoped>
.main-layout {
  height: 100vh;
}

.layout-header {
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-logo {
  font-size: 28px;
  color: #667eea;
}

.header-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.2s;
}

.user-info:hover {
  background: #f5f7fa;
}

.user-avatar {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.user-name {
  font-size: 14px;
  color: #303133;
}

.layout-aside {
  background: #001529;
  overflow-x: hidden;
}

.side-menu {
  border-right: none;
  height: calc(100vh - 60px);
}

.side-menu :deep(.el-menu-item),
.side-menu :deep(.el-sub-menu__title) {
  height: 50px;
  line-height: 50px;
}

.side-menu :deep(.el-menu-item.is-active) {
  background: #1890ff !important;
}

.layout-main {
  background: #f0f2f5;
  padding: 0;
  overflow-y: auto;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
