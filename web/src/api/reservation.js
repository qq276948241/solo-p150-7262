import request from '@/utils/request'

export function getMyReservations(params) {
  return request({
    url: '/reservation/my',
    method: 'get',
    params
  })
}

export function getViolationStatus() {
  return request({
    url: '/reservation/violation-status',
    method: 'get'
  })
}

export function createReservation(data) {
  return request({
    url: '/reservation',
    method: 'post',
    data
  })
}

export function cancelReservation(id) {
  return request({
    url: `/reservation/${id}/cancel`,
    method: 'post'
  })
}
