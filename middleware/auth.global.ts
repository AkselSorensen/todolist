export default defineNuxtRouteMiddleware(async (to) => {
  // Skip on auth pages
  if (to.path.startsWith('/auth/')) return

  const { isAuthenticated, loading, fetchMe } = useAuth()

  // Only fetch on client-side
  if (process.client && loading.value) {
    await fetchMe()
  }

  // If not authenticated and not already on auth page
  if (process.client && !loading.value && !isAuthenticated.value) {
    return navigateTo('/auth/login')
  }
})
