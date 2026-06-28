<template>
  <div class="page-container">
    <div class="card-header">
      <h2>
        <el-icon><Calendar /></el-icon>
        预约自习室
      </h2>
      <el-alert
        v-if="violationStatus.isBanned"
        type="error"
        :closable="false"
        :title="`您本月已违约${violationStatus.count}次，被禁止预约`"
        style="max-width: 400px"
      />
    </div>

    <el-card class="filter-card" shadow="never">
      <el-form :inline="true" :model="filterForm" class="filter-form">
        <el-form-item label="楼栋">
          <el-select
            v-model="filterForm.building_id"
            placeholder="请选择楼栋"
            style="width: 180px"
            @change="handleBuildingChange"
          >
            <el-option
              v-for="b in buildings"
              :key="b.id"
              :label="b.name"
              :value="b.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="自习室">
          <el-select
            v-model="filterForm.room_id"
            placeholder="请选择自习室"
            style="width: 220px"
            :disabled="!filterForm.building_id"
            @change="handleRoomChange"
          >
            <el-option
              v-for="r in rooms"
              :key="r.id"
              :label="`${r.room_no} - ${r.name}`"
              :value="r.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="日期">
          <el-date-picker
            v-model="filterForm.date"
            type="date"
            placeholder="选择日期"
            value-format="YYYY-MM-DD"
            :disabled-date="disabledDate"
            style="width: 180px"
            @change="handleFilterChange"
          />
        </el-form-item>

        <el-form-item label="时段">
          <el-time-picker
            v-model="filterForm.start_time"
            placeholder="开始时间"
            format="HH:mm"
            value-format="HH:mm:00"
            :disabled="!filterForm.room_id"
            :disabled-hours="disabledStartHours"
            :disabled-minutes="disabledStartMinutes"
            style="width: 140px"
            @change="handleTimeChange"
          />
          <span style="margin: 0 8px; color: #909399">至</span>
          <el-time-picker
            v-model="filterForm.end_time"
            placeholder="结束时间"
            format="HH:mm"
            value-format="HH:mm:00"
            :disabled="!filterForm.start_time"
            :disabled-hours="disabledEndHours"
            :disabled-minutes="disabledEndMinutes"
            style="width: 140px"
            @change="handleFilterChange"
          />
        </el-form-item>
      </el-form>

      <div v-if="currentRoom" class="room-info">
        <el-tag type="info">开放时间 {{ currentRoom.open_time?.slice(0, 5) }} - {{ currentRoom.close_time?.slice(0, 5) }}</el-tag>
        <el-tag type="warning" effect="plain">单次最长预约2小时</el-tag>
        <el-tag type="success" effect="plain" v-if="durationMinutes > 0">已选 {{ durationMinutes }} 分钟</el-tag>
        <el-tag type="danger" v-if="durationMinutes > 120">超出2小时限制</el-tag>
      </div>
    </el-card>

    <el-card class="seat-card" shadow="never" style="margin-top: 20px">
      <template #header>
        <div class="seat-header">
          <span>座位选择</span>
          <div class="legend">
            <span class="legend-item"><i class="dot available"></i>可预约</span>
            <span class="legend-item"><i class="dot reserved"></i>已占用</span>
            <span class="legend-item"><i class="dot selected"></i>已选择</span>
            <span class="legend-item"><i class="dot disabled"></i>不可用</span>
          </div>
        </div>
      </template>

      <div v-if="!filterForm.room_id" class="empty-tip">
        <el-empty description="请先选择自习室" />
      </div>
      <div v-else-if="!canLoadSeats" class="empty-tip">
        <el-empty description="请选择完整的日期和时段" />
      </div>
      <div v-else-if="seatsLoading" class="empty-tip">
        <el-icon class="is-loading" :size="40"><Loading /></el-icon>
        <p style="margin-top: 12px; color: #909399">加载座位中...</p>
      </div>
      <div v-else class="seat-grid">
        <div
          v-for="seat in seats"
          :key="seat.id"
          class="seat-item"
          :class="getSeatClass(seat)"
          @click="handleSeatClick(seat)"
        >
          <el-icon v-if="getSeatStatus(seat) === 'available'" class="seat-icon"><Chair /></el-icon>
          <el-icon v-else-if="getSeatStatus(seat) === 'reserved'" class="seat-icon"><Lock /></el-icon>
          <el-icon v-else-if="getSeatStatus(seat) === 'selected'" class="seat-icon"><CircleCheckFilled /></el-icon>
          <el-icon v-else class="seat-icon"><Close /></el-icon>
          <span class="seat-no">{{ seat.seat_no }}</span>
        </div>
      </div>
    </el-card>

    <div v-if="selectedSeat" class="submit-section">
      <el-card shadow="never">
        <div class="submit-info">
          <div>
            <p class="label">已选座位</p>
            <p class="value">
              <el-tag type="primary" size="large">{{ selectedSeat.seat_no }}</el-tag>
              <span style="margin-left: 12px; color: #606266">
                {{ selectedSeat.building_name }} - {{ selectedSeat.room_name }}
              </span>
            </p>
          </div>
          <div>
            <p class="label">预约时段</p>
            <p class="value">
              {{ filterForm.date }}
              {{ filterForm.start_time?.slice(0, 5) }} - {{ filterForm.end_time?.slice(0, 5) }}
              <el-tag type="success" effect="plain" style="margin-left: 8px">{{ durationMinutes }} 分钟</el-tag>
            </p>
          </div>
          <el-button
            type="primary"
            size="large"
            :loading="submitting"
            :disabled="violationStatus.isBanned || durationMinutes > 120 || durationMinutes < 30"
            @click="handleSubmit"
          >
            确认预约
          </el-button>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Calendar, Loading, Chair, Lock, CircleCheckFilled, Close
} from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { getBuildings, getRooms, getRoomDetail, getSeats } from '@/api/room'
import { getViolationStatus, createReservation } from '@/api/reservation'

const buildings = ref([])
const rooms = ref([])
const seats = ref([])
const seatsLoading = ref(false)
const submitting = ref(false)
const selectedSeat = ref(null)
const currentRoom = ref(null)
const violationStatus = ref({ count: 0, isBanned: false, month: '' })

const today = dayjs().format('YYYY-MM-DD')
const filterForm = reactive({
  building_id: '',
  room_id: '',
  date: today,
  start_time: '',
  end_time: ''
})

const durationMinutes = computed(() => {
  if (!filterForm.start_time || !filterForm.end_time) return 0
  const start = dayjs(`2024-01-01 ${filterForm.start_time}`)
  const end = dayjs(`2024-01-01 ${filterForm.end_time}`)
  const diff = end.diff(start, 'minute')
  return diff > 0 ? diff : 0
})

const canLoadSeats = computed(() => {
  return filterForm.room_id && filterForm.date && filterForm.start_time && filterForm.end_time && durationMinutes.value > 0
})

function disabledDate(time) {
  return time.getTime() < dayjs().startOf('day').valueOf()
}

function disabledStartHours() {
  if (!currentRoom.value) return []
  const openH = parseInt(currentRoom.value.open_time?.split(':')[0] || '8')
  const closeH = parseInt(currentRoom.value.close_time?.split(':')[0] || '22')
  const hours = []
  for (let i = 0; i < 24; i++) {
    if (i < openH || i >= closeH) hours.push(i)
  }
  return hours
}

function disabledStartMinutes(h) {
  if (!currentRoom.value) return []
  const openH = parseInt(currentRoom.value.open_time?.split(':')[0] || '8')
  const openM = parseInt(currentRoom.value.open_time?.split(':')[1] || '0')
  const closeH = parseInt(currentRoom.value.close_time?.split(':')[0] || '22')
  if (h === openH) {
    const mins = []
    for (let i = 0; i < openM; i++) mins.push(i)
    return mins
  }
  if (h === closeH - 1) {
    const mins = []
    for (let i = 30; i < 60; i++) mins.push(i)
    return mins
  }
  return []
}

function disabledEndHours() {
  if (!currentRoom.value || !filterForm.start_time) return []
  const startH = parseInt(filterForm.start_time.split(':')[0])
  const closeH = parseInt(currentRoom.value.close_time?.split(':')[0] || '22')
  const maxEndH = Math.min(startH + 2, closeH)
  const hours = []
  for (let i = 0; i < 24; i++) {
    if (i <= startH || i > maxEndH) hours.push(i)
  }
  return hours
}

function disabledEndMinutes(h) {
  if (!currentRoom.value || !filterForm.start_time) return []
  const startH = parseInt(filterForm.start_time.split(':')[0])
  const startM = parseInt(filterForm.start_time.split(':')[1])
  const closeM = parseInt(currentRoom.value.close_time?.split(':')[1] || '0')
  const closeH = parseInt(currentRoom.value.close_time?.split(':')[0] || '22')

  if (h === startH + 1) {
    return []
  }
  if (h === startH) {
    const mins = []
    for (let i = 0; i <= startM; i++) mins.push(i)
    return mins
  }
  if (h === closeH) {
    const mins = []
    for (let i = closeM; i < 60; i++) mins.push(i)
    return mins
  }
  return []
}

function getSeatStatus(seat) {
  const status = String(seat.status || '').toUpperCase()
  if (selectedSeat.value?.id === seat.id) return 'selected'
  if (status === 'DISABLED') return 'disabled'
  if (status === 'RESERVED' || seat.is_reserved) return 'reserved'
  return 'available'
}

function getSeatClass(seat) {
  return `seat-${getSeatStatus(seat)}`
}

function handleSeatClick(seat) {
  const status = getSeatStatus(seat)
  if (status === 'disabled') {
    ElMessage.warning('该座位已停用')
    return
  }
  if (status === 'reserved') {
    ElMessage.warning('该座位该时段已被预约')
    return
  }
  if (status === 'selected') {
    selectedSeat.value = null
    return
  }
  selectedSeat.value = seat
}

async function loadBuildings() {
  try {
    buildings.value = await getBuildings()
    if (buildings.value.length > 0) {
      filterForm.building_id = buildings.value[0].id
      await handleBuildingChange()
    }
  } catch (e) {
    console.error(e)
  }
}

async function handleBuildingChange() {
  filterForm.room_id = ''
  selectedSeat.value = null
  seats.value = []
  try {
    rooms.value = await getRooms({ building_id: filterForm.building_id })
    if (rooms.value.length > 0) {
      filterForm.room_id = rooms.value[0].id
      await handleRoomChange()
    }
  } catch (e) {
    console.error(e)
  }
}

async function handleRoomChange() {
  selectedSeat.value = null
  seats.value = []
  if (!filterForm.room_id) return
  try {
    currentRoom.value = await getRoomDetail(filterForm.room_id)
    if (canLoadSeats.value) {
      await loadSeats()
    }
  } catch (e) {
    console.error(e)
  }
}

function handleTimeChange() {
  if (!filterForm.start_time) {
    filterForm.end_time = ''
  } else {
    const start = dayjs(`2024-01-01 ${filterForm.start_time}`)
    const defaultEnd = start.add(1, 'hour')
    const closeH = parseInt(currentRoom.value?.close_time?.split(':')[0] || '22')
    const closeM = parseInt(currentRoom.value?.close_time?.split(':')[1] || '0')
    const close = dayjs(`2024-01-01 ${String(closeH).padStart(2, '0')}:${String(closeM).padStart(2, '0')}`)
    const end = defaultEnd.isAfter(close) ? close : defaultEnd
    filterForm.end_time = end.format('HH:mm:00')
  }
  selectedSeat.value = null
  handleFilterChange()
}

async function handleFilterChange() {
  selectedSeat.value = null
  if (canLoadSeats.value) {
    await loadSeats()
  } else {
    seats.value = []
  }
}

async function loadSeats() {
  seatsLoading.value = true
  try {
    seats.value = await getSeats({
      room_id: filterForm.room_id,
      date: filterForm.date,
      start_time: filterForm.start_time,
      end_time: filterForm.end_time
    })
  } catch (e) {
    console.error(e)
  } finally {
    seatsLoading.value = false
  }
}

async function loadViolationStatus() {
  try {
    violationStatus.value = await getViolationStatus()
  } catch (e) {
    console.error(e)
  }
}

async function handleSubmit() {
  if (!selectedSeat.value) {
    ElMessage.warning('请选择座位')
    return
  }
  if (durationMinutes.value > 120) {
    ElMessage.warning('预约时长不能超过2小时')
    return
  }
  if (durationMinutes.value < 30) {
    ElMessage.warning('预约时长至少30分钟')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认预约 ${selectedSeat.value.seat_no} 号座位？\n时段：${filterForm.date} ${filterForm.start_time.slice(0, 5)}-${filterForm.end_time.slice(0, 5)}`,
      '确认预约',
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: 'info'
      }
    )
    submitting.value = true
    await createReservation({
      seat_id: selectedSeat.value.id,
      room_id: filterForm.room_id,
      building_id: filterForm.building_id,
      reserve_date: filterForm.date,
      start_time: filterForm.start_time,
      end_time: filterForm.end_time
    })
    ElMessage.success('预约成功')
    selectedSeat.value = null
    await loadSeats()
  } catch (e) {
    if (e !== 'cancel') {
      console.error(e)
    }
  } finally {
    submitting.value = false
  }
}

watch(canLoadSeats, (val) => {
  if (val && filterForm.room_id) {
    loadSeats()
  }
})

onMounted(async () => {
  await loadViolationStatus()
  await loadBuildings()
})
</script>

<style scoped>
.filter-card :deep(.el-form-item) {
  margin-bottom: 0;
}

.room-info {
  margin-top: 16px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.seat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.legend {
  display: flex;
  gap: 18px;
  font-size: 13px;
  color: #606266;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 3px;
}

.dot.available { background: #67c23a; }
.dot.reserved { background: #f56c6c; }
.dot.selected { background: #409eff; }
.dot.disabled { background: #c0c4cc; }

.empty-tip {
  padding: 60px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.seat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: 14px;
  padding: 10px;
}

.seat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 14px 8px;
  border-radius: 8px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}

.seat-available {
  background: #f0f9eb;
  border-color: #e1f3d8;
}
.seat-available:hover {
  background: #e1f3d8;
  border-color: #67c23a;
  transform: translateY(-2px);
}

.seat-reserved {
  background: #fef0f0;
  border-color: #fde2e2;
  cursor: not-allowed;
  opacity: 0.8;
}

.seat-selected {
  background: #ecf5ff;
  border-color: #409eff;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.3);
}
.seat-selected:hover {
  transform: translateY(-2px);
}

.seat-disabled {
  background: #f4f4f5;
  border-color: #e9e9eb;
  cursor: not-allowed;
  opacity: 0.6;
}

.seat-icon {
  font-size: 28px;
}
.seat-available .seat-icon { color: #67c23a; }
.seat-reserved .seat-icon { color: #f56c6c; }
.seat-selected .seat-icon { color: #409eff; }
.seat-disabled .seat-icon { color: #c0c4cc; }

.seat-no {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}

.submit-section {
  margin-top: 20px;
  position: sticky;
  bottom: 20px;
  z-index: 10;
}

.submit-info {
  display: flex;
  align-items: center;
  gap: 40px;
  flex-wrap: wrap;
}

.submit-info .label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
}

.submit-info .value {
  font-size: 15px;
  color: #303133;
  font-weight: 500;
  margin: 0;
}
</style>
