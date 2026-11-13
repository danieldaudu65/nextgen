# NextGen

The new NextGen site: each monthly edition online, with games, a vocab vault, reading streaks and student + school leaderboards.

```
nextgen/
├── client/   Next.js 15 + TypeScript: the website
└── server/   Express 5 + JavaScript (CommonJS) + MongoDB: the API (same layout as BlockHub)
```

## Run it locally

You need Node 18+ and MongoDB (local, or a free MongoDB Atlas cluster).

```bash
# 1. API
cd server
copy .env.example .env      # (Mac/Linux: cp) then fill MONGODB_URI and JWT_SECRET
npm install
npm run seed                # October 2026 edition + sample schools/students
npm run create-admin -- "Your Name" you@punchng.com "a-strong-password"   # first admin (superadmin)
npm run import-stories      # loads scripts/content/articles.js into the current volume as drafts
npm run dev                 # nodemon → http://localhost:5000/health
npm test                    # reading / streak rules + story import checks

# 2. Website (new terminal)
cd client
copy .env.example .env.local
npm install
npm run dev                 # http://localhost:3000
```

Sample login after seeding: handle `amaka.reads`, password `nextgen123`.
Admin panel: http://localhost:3000/admin/login with the email + password you gave `create-admin`.
If the API is down, the website still loads but shows "coming soon" in place of stories (there is no bundled demo content).

## Server layout (same as BlockHub)

```
server/
├── index.js                 ← starts everything: middleware, Mongo, routes
├── config/
│   ├── secrets.js           ← stops the server if MONGODB_URI / JWT_SECRET are missing
│   ├── origins.js           ← which websites may call the API (CORS)
│   └── rules.js             ← ALL points + reading rules (change numbers here)
├── middleware/
│   ├── auth.js              ← must be logged in (reads the "token" cookie, sets req.user)
│   ├── optionalAuth.js      ← guests allowed, req.user set if logged in
│   └── adminAuth.js         ← admins ("admin_token" cookie): requireAdmin + requireRole('editor')
├── models/                  ← student, school, edition, article, admin, debate, debateVote, readProgress, pointsEvent
├── route_public/            ← no login needed: edition.js, school.js, leaderboard.js
├── route_user/              ← students: auth.js, reading.js, games.js, quiz.js, debate.js
├── route_admin/             ← staff: auth, dashboard, articles, editions, schools, team, uploads
├── services/
│   ├── points.js            ← the ONLY place that gives points (ledger + school total + streak)
│   ├── reading.js           ← "is this story read?" + streak maths (with tests)
│   └── summary.js           ← points, rank, school, today's mission for the logged-in student
├── utils/                   ← setAuthCookie, sanitizeStudent, dates (Lagos time)
└── scripts/
    ├── seed.js              ← npm run seed
    ├── createAdmin.js       ← npm run create-admin -- "Name" email "password"
    ├── importStories.js     ← npm run import-stories (stories in content/articles.js → admin)
    └── content/october2026.js
```

Every response looks like `{ success: true, ...data }` or `{ success: false, message: "..." }`.
Login works like BlockHub: an httpOnly `token` cookie (30 days). The website sends it with `credentials: 'include'`.

## Routes

| Method | Route | Login | What it does |
| --- | --- | --- | --- |
| GET | `/health` | | Server + DB status |
| GET | `/editions` | | All editions (the shelf) |
| GET | `/editions/current` | | Current edition (quiz answers removed) |
| GET | `/editions/:slug` | | One edition |
| GET | `/articles` | | Story list (`?edition=oct-2026&section=money&limit=20`) |
| GET | `/articles/:slug` | | One story + the edition's vocab words + 3 related stories |
| GET | `/schools` | | Schools for the sign-up dropdown (`?q=` to search) |
| GET | `/leaderboard` | | `?period=week\|all&limit=5`: top students + top schools |
| POST | `/user_auth/register` | | `{ name, handle, password, schoolId?, className? }` → sets cookie |
| POST | `/user_auth/login` | | `{ handle, password }` → sets cookie |
| POST | `/user_auth/logout` | | Clears cookie |
| GET | `/user_auth/me` | ✔ | Points, streak, rank, school, today's mission |
| POST | `/user_reading/progress` | ✔ | Reading heartbeat `{ edition, article, activeSeconds, scrollDepth }` |
| POST | `/user_games/complete` | ✔ | `{ game, edition }`, once per game per edition |
| POST | `/user_quiz/:slug/check` | optional | `{ questionId, choice }` → `{ correct, answer, awarded }` |
| GET | `/user_debate/current` | optional | Active debate (+ your vote) |
| POST | `/user_debate/:id/vote` | ✔ | `{ side: "A" \| "B" }`, one vote per student |

Admin routes (all need the `admin_token` cookie; role in brackets):

| Method | Route | Role | What it does |
| --- | --- | --- | --- |
| POST | `/admin_auth/login` · `/logout` · GET `/me` | | Staff login (no public sign-up) |
| GET | `/admin_dashboard` | writer | Counts, stories waiting for review, top stories this week |
| GET/POST | `/admin_articles` | writer | List (`?status=&edition=&q=&mine=1`) / create |
| GET/PATCH/DELETE | `/admin_articles/:id` | writer | Writers: own unpublished stories only. Editors: publish, edit any, delete |
| GET/POST/PATCH | `/admin_editions` | editor | Editions (DELETE: superadmin, only when empty) |
| GET/POST/PATCH | `/admin_schools` | editor | Add and verify schools (DELETE: superadmin, only with no students) |
| GET/POST/PATCH | `/admin_team` | superadmin | Add staff, change role, disable, reset password |
| POST | `/admin_uploads/image` | writer | Image upload: Cloudinary if the CLOUDINARY_* keys are set, otherwise `server/uploads/` |
| GET | `/admin_uploads/status` | writer | Where uploads go: `cloudinary` or `local` (shown in the editor) |

## Pages (the site is multi-page and data-driven)

| Page | File | Data |
| --- | --- | --- |
| `/` | `client/src/app/page.tsx` | current edition, debate, leaderboard |
| `/articles/[slug]` | `client/src/app/articles/[slug]/page.tsx` | `GET /articles/:slug` |
| 404 | `client/src/app/not-found.tsx` | |
| `/admin/...` | `client/src/app/admin/` | the admin routes above |

The menu and footer come from `client/src/components/SiteChrome.tsx` (used in `app/layout.tsx`), so every new page gets them automatically. Pages under `/admin` skip them and get the admin sidebar instead.

### Adding a story

A story is one document in the `articles` collection (see `server/models/article.js`). No new code is needed: once it's published, `/articles/<slug>` works. Use the admin panel (**Stories → New story**). In the story box, one line = one block:

```js
body: [
  'A normal paragraph. Mark Vocab Vault words like [[manifesto]].',
  '## A heading',
  '> A yellow callout box',
  '- a bullet',
  '- another bullet',
]
```

## Admin panel

**Roles:** `writer` writes drafts and sends them for review · `editor` publishes, manages editions and schools · `superadmin` also manages the team.

**Story flow:** Draft → Review → Published. Only published stories show on the site; unpublishing hides a story again. Editors can leave a note for the writer.

**Images:** drop a picture on the story editor, click to upload, or paste a link. Replace or remove it any time and press Save. The editor shows where uploads go:
- **Cloudinary** (blue pill) when `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` are in `server/.env`. Use this when the site is live.
- **Saved on server** (orange pill) otherwise: files go to `server/uploads/`. Fine on your PC, but hosts like Render wipe that folder on every deploy.

**Editions:** each year has up to 4 volumes. A volume page has its details, **Categories** (the sections a story can go in), the **Vocab Vault** (tap-for-meaning words) and, under "Games & extras", JSON boxes for the quiz and games.

### Importing stories

Stories can also be written as data in `server/scripts/content/articles.js` (same format as the admin story box), then loaded with one command:

```bash
npm run import-stories                                   # all stories → the volume "On homepage", as drafts
npm run import-stories -- --publish                      # publish them straight away
npm run import-stories -- --edition 2026-december-vol-4  # into another volume (its link)
npm run import-stories -- --only ishaq-ev-for-everyday-people
npm run import-stories -- --update                       # refresh the text of stories already imported
```

It adds any missing categories and Vocab Vault words to the volume, gives the stories to the first superadmin (or `--admin email`), and skips stories that are already in the admin. It never touches pictures, the gallery, the homepage switch or the status you set in the admin, so add the photo in the editor afterwards.

To make a homepage card open the story, set that section's `href` to `/articles/<slug>` in the edition.

## How reading, streaks and leaderboards work

**Counting a story as read**
1. While a logged-in student reads, the website (`client/src/lib/useReadingTracker.ts`) counts **active seconds**: the tab is open *and* they scrolled, tapped or typed in the last 30s. It also tracks how far down the story they got.
2. Every 10s it sends that to `POST /user_reading/progress`.
3. The server counts the story as read at **70% scrolled** + **30% of the estimated read time** (minimum 20s), and never accepts more reading time than has really passed.

**Points** go through `services/points.js` into the `points_events` ledger. Each reward has a unique key, so the same story, quiz question, debate or game can never pay twice.

**Reading Mission:** 3 stories in a day (Lagos time) → +20. **Streak:** any day with points keeps it going; miss a day and it resets. Bonuses at 3 and 7 days.

**Leaderboards:** students are ranked by their own points. Schools are ranked by the **total points of all their students**, because every point a student earns also goes to their school. We also send the average per student so small schools are shown fairly. `week` resets every Monday; `all` is all-time.

## Privacy

Most readers are under 18, so sign-up asks only for a display name, a handle, a password and a school. No email, phone, birthday or photo. Check with Punch's legal team on Nigeria's data protection rules (NDPA) for children before launch.

## Next up

- [x] Story pages: `/articles/[slug]`
- [x] Admin panel
- [ ] Edition page `/editions/[slug]`
- [ ] Arcade page with all six games
- [ ] Friendlier editors for edition games (instead of JSON boxes)
- [ ] Teacher/school accounts to verify students belong to a school
- [ ] Move win checks for the mini-games to the server (like the quiz)
- [ ] Original character art from the design team (current images are placeholder crops from the PDF)

## Paste an article → NextGen format

In **Admin → New story**, open **Paste your article**, paste the plain text and press **✨ Format for NextGen**. It fills the title, summary, category, body (headings, callouts, bullets, `[[vocab]]`), the "explain like I'm 10" version and tags, and suggests vocab words you can add to the volume.

- With `ANTHROPIC_API_KEY` in `server/.env` it uses Claude (`ANTHROPIC_MODEL`, default `claude-sonnet-5-5`). The prompt keeps every fact and adds none. Anything to check is listed under **Please check**.
- **Free option (Groq):** put a key from https://console.groq.com/keys in `GROQ_API_KEY` (no card needed). Model: `GROQ_MODEL`, default `llama-3.3-70b-versatile`.
- **Free option (Gemini):** put a Google Gemini key in `GEMINI_API_KEY` instead (free from https://aistudio.google.com/apikey, no card needed; daily limits apply). Used when the Claude and Groq keys are empty. Change the model with `GEMINI_MODEL` (default `gemini-flash-latest`).
- Without either key it does a basic split (paragraphs, headings, bullets) so the button still works.
- Always read the result before publishing.

## Magazine picture layouts

One line in the story body:

```
@photos https://…/a.jpg | https://…/b.jpg | Caption
@profile Taaooma | 27 | Comedy · Content Creation | https://…/1.jpg | https://…/2.jpg
### Headline about them
Two or three lines about the person.
---
```

- `@photos` with 2 pictures gives the overlapping magazine pair; 3 or more gives a grid.
- `@profile` cards sit two per row (one on phones). A profile's text runs to the next `@profile`, `##` heading, `>` callout or `---`.
- The **◩ Photos** and **☺ Profile** buttons in the editor upload the pictures and write the line for you.
- A story gallery with exactly 2 photos also shows as the overlapping pair.

## Reading check, access, schools and payments

**Install once:** `cd client && npm i` (adds `framer-motion`, used for the 3D/animated parts).

### The reading check (every story)
- A small timer shows how long until the reading points (Admin → Settings, default **2 minutes = +5 pts**).
- Time reached → "+5 points" pop-up. Guests must join / log in to claim it.
- Then the story's **quick-check question** covers the page with a countdown (default **60s**). Scrolling, clicks and the back button are blocked until they answer.
- Right answer → **+5 more**. Wrong / time up → they keep the reading points and get **one retry** (setting).
- Write the question in the story editor ("Quick-check question"), or let **Format for NextGen** write it. The 6 sample stories have one: `npm run import-stories -- --update`.
- The answer never leaves the server.

### Access (who can play)
Reading is free for everyone. With **Games, quick checks & points only with access** on (default), games, quizzes, debates, quick checks and points need:
- **a school code**, if the student's school subscribed, or
- **a student package**, if the student is not in a NextGen school (they can still sign up, then pay on `/get-access`).

The packages are set in Admin → Settings → **Student packages**. The defaults are placeholders, so set your own prices: Monthly ₦500, Term ₦1,200, Yearly ₦3,000.

Without access, the games show blurred behind a "Join to play / Unlock the games" card.

### Schools
- Schools sign up and log in at **`/school/login`**, then use the dashboard at **`/school`**: overview (national rank, seats ring, charts, class vs class, star students), students (unlock a device, remove), codes, plan.
- A plan (e.g. ₦300k for 100 students) gives the school **100 one-time codes**. Share the link `…/join?code=ABCD2345` (the code fills itself in) or the code.
- **1 code = 1 account, locked to 1 device.** New phone? The school presses **Unlock device**.
- Joining without a code is still allowed (no school access).
- The NextGen team can also give a plan by hand: Admin → Schools → **Give plan** (superadmins).

### Payments (Paystack)
- Put `PAYSTACK_SECRET_KEY` and `CLIENT_URL` in `server/.env`.
- In Paystack, set the webhook to `<API address>/paystack/webhook`.
- **Without a key the site runs in DEMO mode:** a test checkout page with "Pay (demo)", no real money.

### Leaderboards (3 boards)
- **Top Readers:** reading + question points.
- **Top Players:** every point, games included.
- **Top Schools:** total, or average per student.
- Admin → Settings → **Leaderboard range**: per volume, per edition (the whole year), weekly or all time. Also rows per board, which boards show, and whether it shows on the homepage.

### Admin dashboard
The **Cards / Charts** switch shows bar charts for 7–90 days:
- points by activity
- reads and quick checks
- new students
- revenue
- top stories and top schools

### Demo data
`npm run seed` creates:
- schools A–C with a plan and D–E without one
- school logins `school-a@nextgen.demo` … `school-e@nextgen.demo` (password `nextgen123`)
- codes, payments, and 14 days of points

It prints a code to try on `/join?code=…`.

## Homepage hero and categories

**How a story gets into the rotating hero at the top of the homepage**
1. The story is **published** and has a **picture**.
2. An editor switches it on: tap the **★** on its row in Admin → Stories, or turn on
   **Show in the homepage hero** in the story editor (section 5, Publishing).
3. The newest one switched on goes first. Admin → Settings → **Homepage hero** sets how many
   show (1–10, default 5) and how many seconds each stays (3–30, default 7).
   Admin → Stories shows the line-up (01, 02, …) and which ones are waiting.

The hero shows dots in the middle, `01 / 05` with a pause button and "Up next" on the right,
and arrows on the left. Hovering pauses it; on phones you can swipe.

API: `GET /articles/homepage` → `{ articles, total, seconds }` ·
`GET /admin_articles/homepage` (line-up) · `PATCH /admin_articles/:id/homepage { on }` (editors).

**Categories = the sections** of the paper: The Big News, Money Matters, Tech Pulse, Pop Culture,
NextGen Stars, SmartToons, Crack This, Vocab Vault, Debate. A category's key is the section key
(`tech`), so a story with section `tech` is in Tech Pulse. They show on the homepage ("Explore"),
in the Categories menu and on `/category/<key>`.
- Every section added to an edition becomes a category automatically.
- **Admin → Categories**: rename, describe, colour, icon, reorder, hide. Renaming keeps the key.
  Paper sections can be hidden but not deleted. A category added there is also offered in the
  story editor's Section list. "Card opens" sends a card elsewhere (Crack This → `/#arcade`).
- Old copied categories (News, Sports, Fact Check…) from the earlier version are removed
  automatically if nobody edited them.

API: `GET /categories` · `GET /categories/:slug` (with its stories) ·
`GET/POST /admin_categories` · `PUT /admin_categories/order { ids }` · `PUT/DELETE /admin_categories/:id` (editors).
