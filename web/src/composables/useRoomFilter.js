import { ref, computed, watch, onUnmounted } from 'vue'
import { getBuildings, getRooms } from '@/api/room'

export function useRoomFilter({ debounceDelay = 300 } = {}) {
  const buildings = ref([])
  const allRooms = ref([])
  const loading = ref(false)

  const selectedBuildingId = ref(null)
  const searchKeyword = ref('')
  const debouncedKeyword = ref('')

  let keywordTimer = null

  watch(searchKeyword, (val) => {
    const safeVal = String(val || '')
    if (safeVal.length > 50) {
      searchKeyword.value = safeVal.slice(0, 50)
      return
    }
    if (keywordTimer) clearTimeout(keywordTimer)
    keywordTimer = setTimeout(() => {
      debouncedKeyword.value = safeVal
    }, debounceDelay)
  }, { immediate: true })

  onUnmounted(() => {
    if (keywordTimer) clearTimeout(keywordTimer)
  })

  const normalizedKeyword = computed(() => {
    const raw = String(debouncedKeyword.value || '')
    const trimmed = raw.trim()
    if (!trimmed || trimmed.length > 50) return ''
    return trimmed.toLowerCase()
  })

  const filteredRooms = computed(() => {
    let list = allRooms.value

    const bid = toIntOrNull(selectedBuildingId.value)
    if (bid !== null) {
      list = list.filter(r => Number(r.building_id) === bid)
    }

    const kw = normalizedKeyword.value
    if (kw) {
      list = list.filter(r => {
        const roomNo = String(r.room_no || '').toLowerCase()
        const name = String(r.name || '').toLowerCase()
        const buildingName = String(r.building_name || '').toLowerCase()
        return roomNo.startsWith(kw) || name.includes(kw) || buildingName.includes(kw)
      })
    }

    return list
  })

  const totalCount = computed(() => allRooms.value.length)
  const filteredCount = computed(() => filteredRooms.value.length)

  async function loadAll() {
    loading.value = true
    try {
      const [buildingList, roomList] = await Promise.all([
        getBuildings(),
        getRooms()
      ])
      buildings.value = buildingList
      allRooms.value = roomList
    } finally {
      loading.value = false
    }
  }

  function isRoomInFiltered(roomId) {
    const rid = toIntOrNull(roomId)
    if (rid === null) return false
    return filteredRooms.value.some(r => Number(r.id) === rid)
  }

  function findRoomById(roomId) {
    const rid = toIntOrNull(roomId)
    if (rid === null) return null
    return allRooms.value.find(r => Number(r.id) === rid) || null
  }

  function resetFilter() {
    selectedBuildingId.value = null
    searchKeyword.value = ''
  }

  return {
    buildings,
    allRooms,
    loading,
    selectedBuildingId,
    searchKeyword,
    debouncedKeyword,
    filteredRooms,
    totalCount,
    filteredCount,
    loadAll,
    isRoomInFiltered,
    findRoomById,
    resetFilter
  }
}

function toIntOrNull(val) {
  if (val === null || val === undefined || val === '') return null
  const n = Number(val)
  return Number.isFinite(n) && Number.isInteger(n) ? n : null
}
