<template>
  <div class="page-container">
    <div class="card-header">
      <h2>
        <el-icon><Warning /></el-icon>
        违约名单
      </h2>
      <el-date-picker
        v-model="filterMonth"
        type="month"
        value-format="YYYY-MM"
        placeholder="选择月份"
        @change="loadData"
      />
    </div>

    <el-row :gutter="20" v-if="bannedList.length > 0">
      <el-col :span="24">
        <el-card shadow="never" class="banned-card">
          <template #header>
            <div class="card-header-inline">
              <el-tag type="danger" effect="dark">本月禁约名单（违约≥3次）</el-tag>
              <span>共 {{ bannedList.length }} 人</span>
            </div>
          </template>
          <div class="banned-grid">
            <div v-for="item in bannedList" :key="item.user_id" class="banned-item">
              <el-avatar :size="40" style="background: #f56c6c">
                {{ item.real_name?.[0] || 'U' }}
              </el-avatar>
              <div class="banned-info">
                <p class="name">{{ item.real_name }}</p>
                <p class="meta">{{ item.student_no }} · 违约 {{ item.violation_count }} 次</p>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" style="margin-top: 20px">
      <template #header>全部违约记录</template>
      <el-table :data="records" v-loading="loading" stripe>
        <el-table-column label="学生姓名" width="120">
          <template #default="{ row }">
            {{ row.real_name }}
          </template>
        </el-table-column>
        <el-table-column prop="student_no" label="学号" width="130" />
        <el-table-column prop="username" label="账号" width="130" />
        <el-table-column label="本月累计" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="row.month_count >= 3 ? 'danger' : 'warning'" effect="light">
              {{ row.month_count }} 次
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="违约原因" />
        <el-table-column prop="created_at" label="违约时间" width="180" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { Warning } from '@element-plus/icons-vue'
import { getViolations } from '@/api/admin'

const loading = ref(false)
const records = ref([])
const bannedList = ref([])
const now = new Date()
const filterMonth = ref(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)

async function loadData() {
  loading.value = true
  try {
    const data = await getViolations({ month: filterMonth.value })
    records.value = data?.records || []
    bannedList.value = data?.banned_list || []
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
.card-header-inline {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.banned-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
}

.banned-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: 8px;
  background: #fef0f0;
  border: 1px solid #fde2e2;
}

.banned-info .name {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 2px 0;
}

.banned-info .meta {
  font-size: 12px;
  color: #909399;
  margin: 0;
}
</style>
