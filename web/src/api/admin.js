import request from '@/utils/request'

export function getAdminBuildings() {
  return request({
    url: '/admin/buildings',
    method: 'get'
  })
}

export function addBuilding(data) {
  return request({
    url: '/admin/buildings',
    method: 'post',
    data
  })
}

export function updateBuilding(id, data) {
  return request({
    url: `/admin/buildings/${id}`,
    method: 'put',
    data
  })
}

export function deleteBuilding(id) {
  return request({
    url: `/admin/buildings/${id}`,
    method: 'delete'
  })
}

export function getAdminRooms(params) {
  return request({
    url: '/admin/rooms',
    method: 'get',
    params
  })
}

export function addRoom(data) {
  return request({
    url: '/admin/rooms',
    method: 'post',
    data
  })
}

export function updateRoom(id, data) {
  return request({
    url: `/admin/rooms/${id}`,
    method: 'put',
    data
  })
}

export function deleteRoom(id) {
  return request({
    url: `/admin/rooms/${id}`,
    method: 'delete'
  })
}

export function getViolations(params) {
  return request({
    url: '/admin/violations',
    method: 'get',
    params
  })
}

export function getStatistics() {
  return request({
    url: '/admin/statistics',
    method: 'get'
  })
}
