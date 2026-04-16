import client from './client'
import type { Driver, Truck, Trailer, Broker, Dispatcher } from '@/types'

const V1 = '/api/v1'

export const driversApi = {
  list: async (isActive?: boolean): Promise<Driver[]> => {
    const params = isActive !== undefined ? { is_active: isActive } : {}
    const { data } = await client.get(`${V1}/drivers`, { params })
    return data
  },
  create: async (payload: Partial<Driver>): Promise<Driver> => {
    const { data } = await client.post(`${V1}/drivers`, payload)
    return data
  },
  update: async (id: number, payload: Partial<Driver>): Promise<Driver> => {
    const { data } = await client.put(`${V1}/drivers/${id}`, payload)
    return data
  },
}

export const trucksApi = {
  list: async (isActive?: boolean): Promise<Truck[]> => {
    const params = isActive !== undefined ? { is_active: isActive } : {}
    const { data } = await client.get(`${V1}/trucks`, { params })
    return data
  },
  create: async (payload: Partial<Truck>): Promise<Truck> => {
    const { data } = await client.post(`${V1}/trucks`, payload)
    return data
  },
}

export const trailersApi = {
  list: async (isActive?: boolean): Promise<Trailer[]> => {
    const params = isActive !== undefined ? { is_active: isActive } : {}
    const { data } = await client.get(`${V1}/trailers`, { params })
    return data
  },
}

export const brokersApi = {
  list: async (isActive?: boolean): Promise<Broker[]> => {
    const params = isActive !== undefined ? { is_active: isActive } : {}
    const { data } = await client.get(`${V1}/brokers`, { params })
    return data
  },
  create: async (payload: Partial<Broker>): Promise<Broker> => {
    const { data } = await client.post(`${V1}/brokers`, payload)
    return data
  },
}

export const dispatchersApi = {
  list: async (isActive?: boolean): Promise<Dispatcher[]> => {
    const params = isActive !== undefined ? { is_active: isActive } : {}
    const { data } = await client.get(`${V1}/dispatchers`, { params })
    return data
  },
}
