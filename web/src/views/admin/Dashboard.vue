<template>
  <div class="page-container">
    <div class="card-header">
      <h2>
        <el-icon><DataLine /></el-icon>
        数据概览
      </h2>
    </div>

    <el-row :gutter="20">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card" v-loading="loading">
          <div class="stat-content">
            <div class="stat-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)">
              <el-icon :size="28"><User /></el-icon>
            </div>
            <div class="stat-info">
              <p class="stat-label">注册学生</p>
              <p class="stat-value">{{ stats?.total_users || 0 }}</p>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card" v-loading="loading">
          <div class="stat-content">
            <div class="stat-icon" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%)">
              <el-icon :size="28"><OfficeBuilding /></el-icon>
            </div>
            <div class="stat-info">
              <p class="stat-label">开放自习室</p>
              <p class="stat-value">{{ stats?.total_rooms || 0 }}</p>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card" v-loading="loading">
          <div class="stat-content">
            <div class="stat-icon" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)">
              <el-icon :size="28"><Chair /></el-icon>
            </div>
            <div class="stat-info">
              <p class="stat-label">可用座位</p>
              <p class="stat-value">{{ stats?.total_seats || 0 }}</p>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card" v-loading="loading">
          <div class="stat-content">
            <div class="stat-icon" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)">
              <el-icon :size="28"><Calendar /></el-icon>
            </div>
            <div class="stat-info">
              <p class="stat-label">今日预约</p>
              <p class="stat-value">{{ stats?.today_reservations || 0 }}</p>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>快捷操作</template>
          <div class="quick-actions">
            <el-button type="primary" size="large" @click="$router.push('/admin/rooms')">
              <el-icon><OfficeBuilding /></el-icon>
              自习室管理
            </el-button>
            <el-button type="warning" size="large" @click="$router.push('/admin/violations')">
              <el-icon><Warning /></el-icon>
              违约名单
            </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { DataLine, User, OfficeBuilding, Chair, Calendar, Warning } from '@element-plus/icons-vue'
import { getStatistics } from '@/api/admin'

const loading = ref(false)
const stats = ref(null)

async function loadStats() {
  loading.value = true
  try {
    stats.value = await getStatistics()
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

onMounted(loadStats)
</script>

<style scoped>
.stat-card {
  border-radius: 10px;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.stat-label {
  font-size: 13px;
  color: #909399;
  margin: 0 0 4px 0;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
  margin: 0;
  line-height: 1;
}

.quick-actions {
  display: flex;
  gap: 16px;
  padding: 10px 0;
}
</style>
