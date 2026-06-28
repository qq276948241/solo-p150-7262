import request from '@/utils/request'

export function getBuildings() {
  return request({
    url: '/room/buildings',
    method: 'get'
  })
}

export function getRooms(params) {
  return request({
    url: '/room/rooms',
    method: 'get',
    params
  })
}

export function getRoomDetail(id) {
  return request({
    url: `/room/rooms/${id}`,
    method: 'get'
  })
}

export function getSeats(params) {
  return request({
    url: '/room/seats',
    method: 'get',
    params
  })
}

export function getOccupiedTimes(params) {
  return request({
    url: '/room/occupied-times',
    method: 'get',
    params
  })
}
