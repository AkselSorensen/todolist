import { getCurrentAccount } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const account = await getCurrentAccount(event)
  return {
    account: {
      id: account.id, email: account.email, name: account.name, color: account.color,
      partnership_id: account.partnership_id, partner_id: account.partner_id,
      partner: account.partner,
    }
  }
})
