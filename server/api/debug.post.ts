export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    return { ok: true, body }
  } catch (e: any) {
    return { ok: false, error: e.message || String(e) }
  }
})
