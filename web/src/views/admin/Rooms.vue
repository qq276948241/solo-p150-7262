<template>
  <div class="page-container">
    <div class="card-header">
      <h2>
        <el-icon><OfficeBuilding /></el-icon>
        自习室管理
      </h2>
      <el-button type="primary" @click="openRoomDialog()">
        <el-icon><Plus /></el-icon>
        新增自习室
      </el-button>
    </div>

    <el-card shadow="never">
      <el-form :inline="true" :model="filterForm" class="mb-20">
        <el-form-item label="楼栋">
          <el-select
            v-model="filterForm.building_id"
            placeholder="全部楼栋"
            clearable
            style="width: 180px"
            @change="loadRooms"
          >
            <el-option v-for="b in buildings" :key="b.id" :label="b.name" :value="b.id" />
          </el-select>
        </el-form-item>
      </el-form>

      <el-table :data="rooms" v-loading="loading" stripe>
        <el-table-column prop="room_no" label="编号" width="100" />
        <el-table-column prop="room_name" label="名称">
          <template #default="{ row }">
            {{ row.name }}
          </template>
        </el-table-column>
        <el-table-column prop="building_name" label="所属楼栋" width="140" />
        <el-table-column label="开放时间" width="160">
          <template #default="{ row }">
            {{ row.open_time?.slice(0, 5) }} - {{ row.close_time?.slice(0, 5) }}
          </template>
        </el-table-column>
        <el-table-column prop="seat_count" label="座位数" width="90" align="center" />
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.is_active" type="success" effect="plain">启用</el-tag>
            <el-tag v-else type="danger" effect="plain">停用</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" size="small" link @click="openRoomDialog(row)">编辑</el-button>
            <el-button type="danger" size="small" link @click="handleDelete(row)">
              {{ row.is_active ? '停用' : '启用' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="roomDialogVisible"
      :title="editingRoom ? '编辑自习室' : '新增自习室'"
      width="500px"
      destroy-on-close
    >
      <el-form ref="roomFormRef" :model="roomForm" :rules="roomRules" label-width="90px">
        <el-form-item label="所属楼栋" prop="building_id">
          <el-select v-model="roomForm.building_id" placeholder="请选择楼栋" style="width: 100%">
            <el-option v-for="b in buildings" :key="b.id" :label="b.name" :value="b.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="名称" prop="name">
          <el-input v-model="roomForm.name" placeholder="例如：第一教学楼1号自习室" />
        </el-form-item>
        <el-form-item label="编号" prop="room_no">
          <el-input v-model="roomForm.room_no" placeholder="例如：A101" />
        </el-form-item>
        <el-form-item label="开放时间" prop="open_time">
          <el-time-picker
            v-model="roomForm.open_time"
            placeholder="开始时间"
            format="HH:mm"
            value-format="HH:mm:00"
            style="width: 45%"
          />
          <span style="width: 10%; text-align: center; display: inline-block">-</span>
          <el-time-picker
            v-model="roomForm.close_time"
            placeholder="结束时间"
            format="HH:mm"
            value-format="HH:mm:00"
            style="width: 45%"
          />
        </el-form-item>
        <el-form-item v-if="!editingRoom" label="座位数" prop="seat_count">
          <el-input-number v-model="roomForm.seat_count" :min="1" :max="200" />
        </el-form-item>
        <el-form-item v-if="editingRoom" label="状态">
          <el-switch v-model="roomForm.is_active" active-text="启用" inactive-text="停用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="roomDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitRoom" :loading="submitting">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox, ElForm } from 'element-plus'
import { OfficeBuilding, Plus } from '@element-plus/icons-vue'
import {
  getAdminBuildings,
  getAdminRooms,
  addRoom,
  updateRoom,
  deleteRoom
} from '@/api/admin'

const loading = ref(false)
const submitting = ref(false)
const buildings = ref([])
const rooms = ref([])
const roomDialogVisible = ref(false)
const editingRoom = ref(null)
const roomFormRef = ref()

const filterForm = reactive({
  building_id: ''
})

const roomForm = reactive({
  building_id: '',
  name: '',
  room_no: '',
  open_time: '08:00:00',
  close_time: '22:00:00',
  seat_count: 20,
  is_active: true
})

const roomRules = {
  building_id: [{ required: true, message: '请选择楼栋', trigger: 'change' }],
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  room_no: [{ required: true, message: '请输入编号', trigger: 'blur' }],
  open_time: [{ required: true, message: '请选择开始时间', trigger: 'change' }],
  close_time: [{ required: true, message: '请选择结束时间', trigger: 'change' }]
}

async function loadBuildings() {
  try {
    buildings.value = await getAdminBuildings()
  } catch (e) {
    console.error(e)
  }
}

async function loadRooms() {
  loading.value = true
  try {
    const params = filterForm.building_id ? { building_id: filterForm.building_id } : {}
    rooms.value = await getAdminRooms(params)
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

function openRoomDialog(row) {
  editingRoom.value = row || null
  if (row) {
    roomForm.building_id = row.building_id
    roomForm.name = row.name
    roomForm.room_no = row.room_no
    roomForm.open_time = row.open_time
    roomForm.close_time = row.close_time
    roomForm.seat_count = row.seat_count || 20
    roomForm.is_active = !!row.is_active
  } else {
    roomForm.building_id = ''
    roomForm.name = ''
    roomForm.room_no = ''
    roomForm.open_time = '08:00:00'
    roomForm.close_time = '22:00:00'
    roomForm.seat_count = 20
    roomForm.is_active = true
  }
  roomDialogVisible.value = true
}

async function submitRoom() {
  if (!roomFormRef.value) return
  try {
    await roomFormRef.value.validate()
    submitting.value = true
    if (editingRoom.value) {
      await updateRoom(editingRoom.value.id, {
        building_id: roomForm.building_id,
        name: roomForm.name,
        room_no: roomForm.room_no,
        open_time: roomForm.open_time,
        close_time: roomForm.close_time,
        is_active: roomForm.is_active ? 1 : 0
      })
      ElMessage.success('更新成功')
    } else {
      await addRoom({
        building_id: roomForm.building_id,
        name: roomForm.name,
        room_no: roomForm.room_no,
        open_time: roomForm.open_time,
        close_time: roomForm.close_time,
        seat_count: roomForm.seat_count
      })
      ElMessage.success('新增成功')
    }
    roomDialogVisible.value = false
    await loadRooms()
  } catch (e) {
    if (e.message !== '验证失败') {
      console.error(e)
    }
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row) {
  try {
    const action = row.is_active ? '停用' : '启用'
    await ElMessageBox.confirm(`确定要${action}【${row.name}】吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    if (row.is_active) {
      await deleteRoom(row.id)
    } else {
      await updateRoom(row.id, {
        building_id: row.building_id,
        name: row.name,
        room_no: row.room_no,
        open_time: row.open_time,
        close_time: row.close_time,
        is_active: 1
      })
    }
    ElMessage.success(`已${action}`)
    await loadRooms()
  } catch (e) {
    if (e !== 'cancel') {
      console.error(e)
    }
  }
}

onMounted(async () => {
  await loadBuildings()
  await loadRooms()
})
</script>
