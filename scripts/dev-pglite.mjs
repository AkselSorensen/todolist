// Postgres jetable en local : PGlite (Postgres compilé en wasm) exposé en socket.
// Sert à lancer l'app sans Neon / sans DATABASE_URL distante, et à rejouer les
// tests d'API sur un schéma neuf.
//
//   node scripts/dev-pglite.mjs                     -> mémoire (tout est perdu au stop)
//   PGLITE_DIR=.data/pg node scripts/dev-pglite.mjs  -> persisté sur disque
//
// Puis : DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres npm run dev
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import { mkdirSync } from 'node:fs'

const port = Number(process.env.PGLITE_PORT || 5433)
const dir = process.env.PGLITE_DIR || undefined

// PGlite ne crée pas les dossiers parents du filesystem : on le fait avant.
if (dir) mkdirSync(dir, { recursive: true })

const db = dir ? new PGlite(dir) : new PGlite()
if (db.waitReady) await db.waitReady

const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1' })
await server.start()
console.log(`PGlite prêt sur postgres://postgres:postgres@127.0.0.1:${port}/postgres${dir ? ` (${dir})` : ' (en mémoire)'}`)

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => { try { await server.stop(); await db.close() } catch {} ; process.exit(0) })
}
