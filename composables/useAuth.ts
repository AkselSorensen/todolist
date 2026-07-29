export const useAuth = () => {
  const account = useState<any>('auth:account', () => null)
  const loading = useState('auth:loading', () => true)

  async function fetchMe() {
    try {
      const data = await $fetch('/api/auth/me')
      account.value = data.account
    } catch {
      account.value = null
    } finally {
      loading.value = false
    }
  }

  async function login(email: string, password: string) {
    const data = await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    account.value = data.account
    return data.account
  }

  async function register(email: string, password: string, name: string) {
    const data = await $fetch('/api/auth/register', {
      method: 'POST',
      body: { email, password, name },
    })
    account.value = data.account
    return data.account
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    account.value = null
    navigateTo('/auth/login')
  }

  async function invitePartner(partnerEmail: string) {
    const data = await $fetch('/api/auth/invite-partner', {
      method: 'POST',
      body: { partnerEmail },
    })
    account.value = data.account
    return data.account
  }

  // Try to refresh token on 401
  async function refreshIfNeeded() {
    try {
      await $fetch('/api/auth/refresh', { method: 'POST' })
      await fetchMe()
    } catch {
      account.value = null
    }
  }

  const isAuthenticated = computed(() => !!account.value)
  const hasPartner = computed(() => !!account.value?.partner)
  const partnerName = computed(() => account.value?.partner?.name || null)

  return { account, loading, isAuthenticated, hasPartner, partnerName, fetchMe, login, register, logout, invitePartner, refreshIfNeeded }
}
