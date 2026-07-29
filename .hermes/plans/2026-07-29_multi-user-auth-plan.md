# Nous Deux → Plateforme Multi-Utilisateurs — Plan d'Implémentation

> **For Hermes:** Use this plan task-by-task. Each task is bite-sized (2-5 min).

**Goal:** Transformer "Nous Deux" (app couple hardcodée Aksel/Amandine) en plateforme SaaS où n'importe qui peut register/login, avoir sa propre carte, et inviter son/sa partenaire pour tout partager (carte, todos, calendrier).

**Architecture:** JWT auth stocké dans un cookie httpOnly. Chaque utilisateur a un compte (`accounts` table). Deux utilisateurs forment un "partnership" — toutes les données (pays visités, todos, events) sont scopées au partnership. Un middleware Nitro vérifie le JWT sur toutes les routes API existantes.

**Tech Stack:** Nuxt 3 (Vue 3 + Nitro), Tailwind v4, GSAP, Neon PostgreSQL (pg), Leaflet, JWT (jsonwebtoken + bcryptjs), Vercel.

---

## Schéma DB cible

```sql
-- Auth
accounts (id, email UNIQUE, password_hash, name, color, partner_id REFERENCES accounts, partnership_id REFERENCES partnerships, created_at)
partnerships (id, created_at)
refresh_tokens (id, account_id, token, expires_at)

-- Données scopées au partnership
visited_countries (id, country_name, partnership_id FK, visited_by TEXT)  -- visited_by = account_id ou 'both' ou 'wishlist'
todos (..., partnership_id FK, created_by → account_id, assigned_to → account_id)
calendar_events (..., partnership_id FK, created_by → account_id)
todo_categories (..., partnership_id FK)
countries → reste global (commun à tous)
```

**Migration du `visited_by`:** l'ancien format texte ('aksel'/'amandine') devient des IDs de compte. La migration mappera les anciens noms vers les IDs.

---

## Phase 1 — Auth (backend)

### Task 1: Installer jsonwebtoken et bcryptjs
```bash
cd /c/Users/azrae/nous-deux && npm install jsonwebtoken bcryptjs && npm install -D @types/jsonwebtoken @types/bcryptjs
```

### Task 2: Créer la table `accounts` + `partnerships` + `refresh_tokens` dans setup.post.ts
- Ajouter les `CREATE TABLE IF NOT EXISTS` pour les 3 nouvelles tables
- `accounts`: id SERIAL PK, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, name TEXT NOT NULL, color TEXT DEFAULT '#ff6b8a', partner_id INT REFERENCES accounts, partnership_id INT REFERENCES partnerships, created_at TIMESTAMPTZ DEFAULT NOW()
- `partnerships`: id SERIAL PK, created_at TIMESTAMPTZ DEFAULT NOW()
- `refresh_tokens`: id SERIAL PK, account_id INT REFERENCES accounts NOT NULL, token TEXT UNIQUE NOT NULL, expires_at TIMESTAMPTZ NOT NULL

### Task 3: Ajouter `partnership_id` aux tables existantes dans setup.post.ts
- `visited_countries`: ADD COLUMN partnership_id INT REFERENCES partnerships
- `todos`: ADD COLUMN partnership_id INT REFERENCES partnerships
- `calendar_events`: ADD COLUMN partnership_id INT REFERENCES partnerships
- `todo_categories`: ADD COLUMN partnership_id INT REFERENCES partnerships
- Tous avec `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`

### Task 4: Créer `server/utils/auth.ts` — helpers JWT
- `generateTokens(accountId)` → { accessToken, refreshToken }
- `verifyAccessToken(token)` → payload | null
- `hashPassword(pw)` → hash, `comparePassword(pw, hash)` → boolean
- Access token: 15min, Refresh token: 7 jours
- SECRET vient de `process.env.JWT_SECRET`

### Task 5: Créer `server/middleware/auth.ts` — middleware global
- Extrait le JWT du cookie `auth_token`
- Vérifie avec `verifyAccessToken`
- Injecte `event.context.account = { id, email, name, partnership_id }` dans le contexte
- Skip pour les routes publiques: `/api/auth/*`, `/api/setup`, `/api/countries` (GET)
- Renvoie 401 si invalide

### Task 6: Créer `POST /api/auth/register`
- Valide email + password (6+ chars) + name
- Vérifie email non utilisé
- Hash password, insert account
- Génère tokens, set cookie `auth_token` (httpOnly, secure, sameSite=lax, maxAge 15min)
- Set aussi `refresh_token` cookie (7j)
- Retourne `{ account: { id, email, name } }`

### Task 7: Créer `POST /api/auth/login`
- Vérifie email + password
- Génère tokens, set cookies
- Retourne `{ account: { id, email, name, partnership_id, partner_id } }`

### Task 8: Créer `POST /api/auth/logout`
- Clear cookies
- Supprime refresh_token de la DB
- Retourne `{ success: true }`

### Task 9: Créer `GET /api/auth/me`
- Lit `event.context.account` (mis par le middleware)
- Retourne l'account avec partenaire info
- JOIN accounts partner ON accounts.partner_id = partner.id

### Task 10: Créer `POST /api/auth/refresh`
- Lit le `refresh_token` cookie
- Vérifie en DB + expiration
- Génère nouveau access + refresh token
- Rotation du refresh token

### Task 11: Créer `POST /api/auth/invite-partner`
- Requiert auth
- Prend l'email du partenaire
- Vérifie que l'account existe
- Crée un `partnership` (INSERT INTO partnerships DEFAULT VALUES)
- Met à jour les deux accounts: `partnership_id = X, partner_id = other_id`
- Les données existantes du demandeur sont migrées vers le partnership_id

---

## Phase 2 — Migration des données existantes

### Task 12: Script de migration `server/api/migrate.post.ts`
- Prend les anciens users 'Aksel'/'Amandine' → crée les accounts
- Crée un partnership pour eux
- Migre `visited_countries`: map 'aksel' → aksel_id, 'amandine' → amandine_id
- Migre `todos`: created_by/assigned_to mappés, ajout partnership_id
- Migre `calendar_events`: idem
- Ajoute `partnership_id` aux catégories

---

## Phase 3 — Refactor API avec scope partnership

### Task 13: Refactor `GET/POST /api/visited` — scoper par partnership_id
- `GET`: filtre par `event.context.account.partnership_id`
- `POST`: utilise `partnership_id` du compte, `visited_by` = account_id ou 'both' ou 'wishlist'

### Task 14: Refactor `server/api/todos/index.ts` — scoper par partnership_id
- `GET`: filtre par `partnership_id`
- `POST`: ajoute `partnership_id` depuis le compte + `created_by` = account_id

### Task 15: Refactor `server/api/todos/[id].ts` — vérifier ownership
- Vérifie que le todo appartient au partnership du compte

### Task 16: Refactor `server/api/calendar/index.ts` — scoper par partnership_id
- `GET`: filtre par `partnership_id`
- `POST`: ajoute `partnership_id` + `created_by` = account_id
- `DELETE`: vérifie ownership

---

## Phase 4 — Frontend Auth UI

### Task 17: Créer `composables/useAuth.ts` — state auth réactif
```ts
export const useAuth = () => {
  const account = ref<any>(null)
  const loading = ref(true)

  async function fetchMe() { ... }
  async function login(email, password) { ... }
  async function register(email, password, name) { ... }
  async function logout() { ... }
  async function invitePartner(email) { ... }

  return { account, loading, fetchMe, login, register, logout, invitePartner }
}
```

### Task 18: Créer `pages/auth/login.vue` — page login
- Formulaire email + mot de passe
- Design dark élégant (même style que le reste)
- Logo "Nous Deux" en haut
- Lien vers register

### Task 19: Créer `pages/auth/register.vue` — page register
- Email + mot de passe + prénom
- Même design que login
- Redirige vers onboarding après succès

### Task 20: Créer `pages/auth/onboarding.vue` — inviter son partenaire
- Affiche "Invite ton/ta partenaire"
- Input email + bouton envoyer
- Ou "Plus tard" → dashboard

### Task 21: Créer `middleware/auth.global.ts` — guard frontend
- Vérifie si l'utilisateur est loggé (appelle `/api/auth/me`)
- Si pas loggé et pas sur /auth/* : redirect → /auth/login
- Si loggé et sur /auth/* : redirect → /
- Appel à `useAuth().fetchMe()` au mount de l'app

### Task 22: Modifier `layouts/default.vue` — ajouter user menu
- Remplacer "Aksel & Amandine" par le nom du partnership ou "Mon compte"
- Ajouter dropdown avec: profil, déconnexion
- Afficher le nom du partenaire si présent

### Task 23: Modifier `pages/index.vue` — dynamiser avec le compte
- Remplacer les noms hardcodés "Aksel"/"Amandine" par les vrais noms des comptes
- Mini-map: utiliser les données du partnership
- Stats: basées sur les données réelles du partnership

### Task 24: Modifier `pages/carte.vue` — dynamiser les noms
- Remplacer "Aksel"/"Amandine" dans les scores et labels par les noms du partnership
- Utiliser `useAuth().account` pour récupérer les infos partenaire
- Les couleurs des joueurs viennent de `account.color`

### Task 25: Modifier `pages/todos.vue` + `pages/calendrier.vue` — adapter
- Remplacer les user IDs hardcodés par les vrais IDs du partnership
- Les assignations utilisent les membres du partnership

---

## Phase 5 — Déploiement & Tests

### Task 26: Configurer JWT_SECRET sur Vercel
- Ajouter `JWT_SECRET` dans les env vars Vercel (générer avec `openssl rand -hex 32`)

### Task 27: Vérifier le build
```bash
npm run build
```

### Task 28: Push + déploiement auto Vercel
- `git add -A && git commit -m "feat: multi-user auth platform" && git push`
- Vercel déploie automatiquement sur push main

---

## Résumé des fichiers

| Fichier | Action |
|---|---|
| `server/utils/auth.ts` | **NEW** — helpers JWT, hash, tokens |
| `server/middleware/auth.ts` | **NEW** — middleware auth global |
| `server/api/auth/register.post.ts` | **NEW** |
| `server/api/auth/login.post.ts` | **NEW** |
| `server/api/auth/logout.post.ts` | **NEW** |
| `server/api/auth/me.get.ts` | **NEW** |
| `server/api/auth/refresh.post.ts` | **NEW** |
| `server/api/auth/invite-partner.post.ts` | **NEW** |
| `server/api/migrate.post.ts` | **NEW** — migration données |
| `server/api/setup.post.ts` | **MODIFY** — ajout tables auth + partnership_id |
| `server/api/visited/index.ts` | **MODIFY** — scope partnership |
| `server/api/todos/index.ts` | **MODIFY** — scope partnership |
| `server/api/todos/[id].ts` | **MODIFY** — ownership check |
| `server/api/calendar/index.ts` | **MODIFY** — scope partnership |
| `composables/useAuth.ts` | **NEW** — auth state |
| `composables/useApi.ts` | **MODIFY** — add auth methods |
| `middleware/auth.global.ts` | **NEW** — guard frontend |
| `pages/auth/login.vue` | **NEW** |
| `pages/auth/register.vue` | **NEW** |
| `pages/auth/onboarding.vue` | **NEW** |
| `layouts/default.vue` | **MODIFY** — user menu |
| `pages/index.vue` | **MODIFY** — dynamique |
| `pages/carte.vue` | **MODIFY** — noms dynamiques |
| `pages/todos.vue` | **MODIFY** — users dynamiques |
| `pages/calendrier.vue` | **MODIFY** — users dynamiques |
| `app.vue` | **MODIFY** — init auth au boot |
| `nuxt.config.ts` | **MODIFY** — app title générique |

---

## Risques & Décisions

1. **JWT vs sessions DB**: JWT cookie httpOnly est plus simple, pas de state serveur. Acceptable pour cette échelle.
2. **Pas de "forgot password"**: V1 sans — rajoutable plus tard.
3. **Migration des données existantes**: Le script de migration préserve les données d'Aksel/Amandine.
4. **Un partnership = exactement 2 personnes**: Le modèle actuel. Extensible plus tard.
5. **Pas d'email d'invitation**: V1 — l'invitation est "directe" (l'utilisateur entre l'email, le système vérifie que le compte existe et les lie). Un vrai système d'email serait en V2.

---

## Ordre d'exécution recommandé

Phase 1 → Phase 2 → (test manuel) → Phase 3 → Phase 4 → Phase 5
