export const useApi = () => {
  const config = useRuntimeConfig()

  async function fetchTodos(filters?: { category?: string; status?: string; assigned?: string }) {
    const params = new URLSearchParams(filters as any || {}).toString()
    return await $fetch(`/api/todos${params ? '?' + params : ''}`)
  }

  async function createTodo(data: any) {
    return await $fetch('/api/todos', { method: 'POST', body: data })
  }

  async function updateTodo(id: number, data: any) {
    return await $fetch(`/api/todos/${id}`, { method: 'PATCH', body: data })
  }

  async function deleteTodo(id: number) {
    return await $fetch(`/api/todos/${id}`, { method: 'DELETE' })
  }

  async function fetchEvents(from?: string, to?: string) {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    return await $fetch(`/api/calendar${params.toString() ? '?' + params : ''}`)
  }

  async function createEvent(data: any) {
    return await $fetch('/api/calendar', { method: 'POST', body: data })
  }

  async function deleteEvent(id: number) {
    return await $fetch(`/api/calendar?id=${id}`, { method: 'DELETE' })
  }

  async function fetchUsers() {
    return await $fetch('/api/users')
  }

  async function setupDb() {
    return await $fetch('/api/setup', { method: 'POST' })
  }

  return { fetchTodos, createTodo, updateTodo, deleteTodo, fetchEvents, createEvent, deleteEvent, fetchUsers, setupDb }
}
