// Hardcoded auth for Aksel & Amandine — no login needed
export default defineEventHandler(async (event) => {
  const path = event.path
  if (!path.startsWith('/api/')) return

  // Public paths (countries, setup, messages)
  if (path === '/api/countries' && event.method === 'GET') return
  if (path === '/api/setup') return
  if (path === '/api/messages') return

  // Hardcoded Aksel account
  event.context.account = {
    id: 4,
    email: 'aksel@nousdeux.fr',
    name: 'Aksel',
    partnership_id: 1,
    partner_id: 5,
  }
})
