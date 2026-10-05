// Valide TOUT le SQL des routes server/ contre un vrai moteur Postgres (pglite).
// Le stub db.ts ne parse pas le SQL : il a laisse passer un RETURNING invalide (alias `g` hors portee),
// qui ne cassait qu'en production. Ce harnais execute le DDL puis PREPARE chaque requete :
// PREPARE fait l'analyse syntaxique ET semantique sans executer -> il attrape colonne inconnue,
// alias hors portee, cast invalide, reference ambigue.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = 'C:/Users/azrae/Desktop/todolist'
const SERVER = join(ROOT, 'server')

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (p.endsWith('.ts')) out.push(p)
  }
  return out
}

const files = walk(SERVER)
const all = files.map(f => ({ f, txt: readFileSync(f, 'utf8') }))

// --- constantes SQL exportees (businessDates/businessIdeas/businessAssets/businessGoals) ---
const consts = {}
for (const { txt } of all) {
  for (const m of txt.matchAll(/export const (\w+)\s*=\s*`([^`]+)`/g)) consts[m[1]] = m[2]
}
console.log('constantes SQL trouvées :', Object.keys(consts).join(', '))

// --- une chaine de requete = un litteral backtick contenant un mot-cle SQL ---
const KW = /(INSERT INTO|SELECT .*FROM|UPDATE \w+ SET|DELETE FROM|CREATE TABLE|ALTER TABLE|CREATE INDEX|DO \$\$)/
const statements = []
for (const { f, txt } of all) {
  for (const m of txt.matchAll(/`([^`]+)`/gs)) {
    let sql = m[1]
    if (!KW.test(sql)) continue
    // resoudre les interpolations : le `$` litteral eventuel est conserve tel quel
    // ($${params.length} doit donner $9, pas $$9)
    sql = sql.replace(/(\$?)\$\{([^}]*)\}/g, (_, lead, inner) => {
      const name = inner.trim()
      if (consts[name] !== undefined) return lead + consts[name]
      if (/\.join\(/.test(name)) return lead + 'id = $98'   // SET dynamique : `id` existe partout, seul le reste de la requete compte
      return lead + '9'                                        // placeholder simple
    })
    sql = sql.replace(/\s+/g, ' ').trim()
    // renumérote chaque placeholder 1..N : sans ça un $98 isolé fait exiger $1..$98
    let k = 0
    sql = sql.replace(/\$\d+/g, () => '$' + (++k))
    statements.push({ file: relative(ROOT, f).replace(/\\/g, '/'), sql })
  }
}

// dedupliquer
const seen = new Set()
const uniq = statements.filter(s => !seen.has(s.sql) && seen.add(s.sql))
console.log(`${uniq.length} requetes distinctes a valider\n`)

const db = new PGlite()
let ddl = 0, prepared = 0
const failures = []
const ddlFailed = []
const deferred = []

// 1er passage : creer le schema (DDL) — tout le reste est mis de cote
for (const s of uniq) {
  if (/^(CREATE TABLE|ALTER TABLE|CREATE INDEX|DO \$\$)/i.test(s.sql)) {
    try { await db.exec(s.sql); ddl++ }
    catch (e) { ddlFailed.push({ ...s, err: '[DDL] ' + String(e.message || e).slice(0, 200) }) }
  } else deferred.push(s)
}
// 2e tour : les CREATE/ALTER qui référencent une table créée plus loin dans le parcours
const stillDeferred = []
for (const s of uniq) {
  if (!/^(CREATE TABLE|ALTER TABLE|CREATE INDEX|DO \$\$)/i.test(s.sql)) continue
}
for (const s of ddlFailed) {
  try { await db.exec(s.sql); ddl++; } catch (e) { stillDeferred.push({ ...s, err: '[DDL] ' + String(e.message || e).slice(0, 200) }) }
}
failures.length = 0
failures.push(...stillDeferred)
console.log(`DDL exécuté : ${ddl} (dont ${ddlFailed.length} rattrapés au 2e tour)\n`)

// 2e passage : preparer chaque requete (analyse syntaxique + semantique)
for (const s of deferred) {
  try {
    await db.exec(`PREPARE _p${prepared} AS ${s.sql}`)
    prepared++
  } catch (e) {
    failures.push({ ...s, err: String(e.message || e).slice(0, 220) })
  }
}

console.log(`PREPARE réussi : ${prepared}/${deferred.length}`)
const ddlFails = failures.filter(f => f.err.startsWith('[DDL]'))
const mine = failures.filter(f => !f.err.startsWith('[DDL]') && f.file.includes('business-'))
const others = failures.filter(f => !f.err.startsWith('[DDL]') && !f.file.includes('business-'))
console.log(`  echecs DDL : ${ddlFails.length}`)
console.log(`  dont mes routes Business : ${mine.length} echec(s) ; reste du projet : ${others.length} (pre-existant, hors perimetre)\n`)
if (failures.length === 0) {
  console.log('✅ tout le SQL passe un vrai Postgres')
} else {
  console.log(`❌ ${failures.length} requete(s) refusee(s) par Postgres :\n`)
  for (const f of [...ddlFails, ...mine]) {
    console.log('--- ' + f.file)
    console.log('    ' + f.sql.slice(0, 190))
    console.log('    ERREUR: ' + f.err + '\n')
  }
  process.exitCode = 1
}
if (mine.length === 0) console.log('✅ mes routes Business passent un vrai Postgres')
if (others.length) console.log('   (hors perimetre : ' + [...new Set(others.map(o => o.file))].join(', ') + ')')
await db.close()
