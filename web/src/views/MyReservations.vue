<template>
  <div class="page-container">
    <div class="card-header">
      <h2>
        <el-icon><Tickets /></el-icon>
        我的预约
      </h2>
      <el-radio-group v-model="statusFilter" @change="loadReservations" size="default">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button value="confirmed">进行中</el-radio-button>
        <el-radio-button value="cancelled">已取消</el-radio-button>
        <el-radio-button value="violated">已违约</el-radio-button>
      </el-radio-group>
    </div>

    <el-alert
      v-if="violationStatus.count > 0"
      :type="violationStatus.isBanned ? 'error' : 'warning'"
      :closable="false"
      show-icon
      style="margin-bottom: 20px"
    >
      <template #title>
        本月违约记录：<strong>{{ violationStatus.count }}</strong> 次
        <span v-if="violationStatus.isBanned">，已达 3 次，本月禁止预约</span>
        <span v-else>，累计 3 次将被禁止预约</span>
      </template>
    </el-alert>

    <el-card shadow="never" v-loading="loading">
      <el-table :data="reservations" empty-text="暂无预约记录" stripe>
        <el-table-column prop="building_name" label="楼栋" width="130" />
        <el-table-column label="自习室" width="180">
          <template #default="{ row }">
            {{ row.room_no }} - {{ row.room_name }}
          </template>
        </el-table-column>
        <el-table-column prop="seat_no" label="座位号" width="100">
          <template #default="{ row }">
            <el-tag type="primary" effect="plain">{{ row.seat_no }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="reserve_date" label="日期" width="130" />
        <el-table-column label="时段" width="140">
          <template #default="{ row }">
            {{ row.start_time?.slice(0, 5) }} - {{ row.end_time?.slice(0, 5) }}
          </template>
        </el-table-column>
        <el-table-column label="时长" width="90">
          <template #default="{ row }">
            {{ getDuration(row.start_time, row.end_time) }}分钟
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.can_cancel"
              type="danger"
              size="small"
              link
              @click="handleCancel(row)"
            >
              取消预约
            </el-button>
            <el-tooltip v-else-if="row.status === 'confirmed'" content="开始前15分钟内不可取消">
              <el-button type="info" size="small" link disabled>取消预约</el-button>
            </el-tooltip>
            <span v-else>-</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Tickets } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { getMyReservations, cancelReservation, getViolationStatus } from '@/api/reservation'

const loading = ref(false)
const reservations = ref([])
const statusFilter = ref('')
const violationStatus = ref({ count: 0, isBanned: false, month: '' })

function getDuration(start, end) {
  if (!start || !end) return 0
  const s = dayjs(`2024-01-01 ${start}`)
  const e = dayjs(`2024-01-01 ${end}`)
  return e.diff(s, 'minute')
}

function getStatusType(status) {
  const map = {
    pending: 'warning',
    confirmed: 'success',
    cancelled: 'info',
    violated: 'danger'
  }
  return map[status] || 'info'
}

function getStatusText(status) {
  const map = {
    pending: '待确认',
    confirmed: '进行中',
    cancelled: '已取消',
    violated: '已违约'
  }
  return map[status] || status
}

async function loadReservations() {
  loading.value = true
  try {
    const params = statusFilter.value ? { status: statusFilter.value } : {}
    reservations.value = await getMyReservations(params)
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function loadViolation() {
  try {
    violationStatus.value = await getViolationStatus()
  } catch (e) {
    console.error(e)
  }
}

async function handleCancel(row) {
  try {
    await ElMessageBox.confirm(
      `确定要取消 ${row.reserve_date} ${row.start_time?.slice(0, 5)}-${row.end_time?.slice(0, 5)} 的预约吗？\n开始前15分钟内取消将记违约1次。`,
      '取消预约',
      {
        confirmButtonText: '确认取消',
        cancelButtonText: '再想想',
        type: 'warning'
      }
    )
    const res = await cancelReservation(row.id)
    if (res?.is_violation) {
      ElMessage.warning('已取消，本次取消记违约1次')
    } else {
      ElMessage.success('取消成功')
    }
    await loadReservations()
    await loadViolation()
  } catch (e) {
    if (e !== 'cancel') {
      console.error(e)
    }
  }
}

onMounted(async () => {
  await loadViolation()
  await loadReservations()
})
</script>
