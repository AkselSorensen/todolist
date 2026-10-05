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

  async function updateEvent(id: number, data: any) {
    return await $fetch(`/api/calendar?id=${id}`, { method: 'PATCH', body: data })
  }

  async function deleteEvent(id: number) {
    return await $fetch(`/api/calendar?id=${id}`, { method: 'DELETE' })
  }

  async function fetchUsers() {
    return await $fetch('/api/users')
  }

  async function fetchAnniversary() {
    return await $fetch('/api/anniversary')
  }

  async function updateAnniversary(data: any) {
    return await $fetch('/api/anniversary', { method: 'PATCH', body: data })
  }

  // --- Business dates (rendez-vous pro, partagés dans le couple) ---
  async function fetchBusinessDates(filters?: { from?: string; to?: string; status?: string }) {
    const params = new URLSearchParams()
    if (filters?.from) params.set('from', filters.from)
    if (filters?.to) params.set('to', filters.to)
    if (filters?.status) params.set('status', filters.status)
    return await $fetch(`/api/business-dates${params.toString() ? '?' + params : ''}`)
  }

  async function createBusinessDate(data: any) {
    return await $fetch('/api/business-dates', { method: 'POST', body: data })
  }

  async function updateBusinessDate(id: number, data: any) {
    return await $fetch(`/api/business-dates/${id}`, { method: 'PATCH', body: data })
  }

  async function deleteBusinessDate(id: number) {
    return await $fetch(`/api/business-dates/${id}`, { method: 'DELETE' })
  }

  // --- Business ideas (idées, quoi faire, combien d'argent) ---
  async function fetchBusinessIdeas(filters?: { stage?: string; domain?: string }) {
    const params = new URLSearchParams()
    if (filters?.stage) params.set('stage', filters.stage)
    if (filters?.domain) params.set('domain', filters.domain)
    return await $fetch(`/api/business-ideas${params.toString() ? '?' + params : ''}`)
  }

  async function createBusinessIdea(data: any) {
    return await $fetch('/api/business-ideas', { method: 'POST', body: data })
  }

  async function updateBusinessIdea(id: number, data: any) {
    return await $fetch(`/api/business-ideas/${id}`, { method: 'PATCH', body: data })
  }

  async function deleteBusinessIdea(id: number) {
    return await $fetch(`/api/business-ideas/${id}`, { method: 'DELETE' })
  }

  async function createBusinessIdeaTask(ideaId: number, data: any) {
    return await $fetch(`/api/business-ideas/${ideaId}/tasks`, { method: 'POST', body: data })
  }

  async function updateBusinessIdeaTask(ideaId: number, taskId: number, data: any) {
    return await $fetch(`/api/business-ideas/${ideaId}/tasks`, { method: 'PATCH', body: { id: taskId, ...data } })
  }

  async function deleteBusinessIdeaTask(ideaId: number, taskId: number) {
    return await $fetch(`/api/business-ideas/${ideaId}/tasks?id=${taskId}`, { method: 'DELETE' })
  }

  // --- Ce qu'on possède déjà (actifs par personne ou en commun) ---
  async function fetchBusinessAssets(filters?: { category?: string; owner?: string | number }) {
    const params = new URLSearchParams()
    if (filters?.category) params.set('category', filters.category)
    if (filters?.owner !== undefined && filters?.owner !== '') params.set('owner', String(filters.owner))
    return await $fetch(`/api/business-assets${params.toString() ? '?' + params : ''}`)
  }

  async function createBusinessAsset(data: any) {
    return await $fetch('/api/business-assets', { method: 'POST', body: data })
  }

  async function updateBusinessAsset(id: number, data: any) {
    return await $fetch(`/api/business-assets/${id}`, { method: 'PATCH', body: data })
  }

  async function deleteBusinessAsset(id: number) {
    return await $fetch(`/api/business-assets/${id}`, { method: 'DELETE' })
  }

  async function setupDb() {
    return await $fetch('/api/setup', { method: 'POST' })
  }

  return {
    fetchTodos, createTodo, updateTodo, deleteTodo,
    fetchEvents, createEvent, updateEvent, deleteEvent,
    fetchUsers, fetchAnniversary, updateAnniversary,
    fetchBusinessDates, createBusinessDate, updateBusinessDate, deleteBusinessDate,
    fetchBusinessIdeas, createBusinessIdea, updateBusinessIdea, deleteBusinessIdea,
    createBusinessIdeaTask, updateBusinessIdeaTask, deleteBusinessIdeaTask,
    fetchBusinessAssets, createBusinessAsset, updateBusinessAsset, deleteBusinessAsset,
    setupDb,
  }
}
