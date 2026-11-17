# PUNCH NextGen: handover for a new chat

Read this first. It is everything you need to carry on with the NextGen website without the earlier chat.

## Who and what
- I'm **Daniel**, a contract full-stack developer at PUNCH NextGen.
- We are rebuilding **punchnextgen.com**, a newspaper/magazine site for Nigerian teenagers (12–18). It covers editions, stories, games, a vocab vault, leaderboards, NextGen Stars, schools, and an admin newsroom.
- The project is on my PC at **`C:\Projects\nextgen`**. Work on the files there through the desktop app connection.

## The code
| Part | Where | Stack |
|---|---|---|
| Website + admin + school dashboard | `client/` | Next.js 15 (App Router), TypeScript, React |
| API | `server/` | Node, Express 5, Mongoose (MongoDB), multer, Cloudinary (optional) |

**Client: main places**
- `client/src/app/`: the pages
  - `page.tsx` is the homepage. Its order: hero → Money scene → categories → edition → arcade → vocab → stars → leaderboard → shelf.
  - Other pages: `admin/…`, `school/…`, `articles/[slug]`, `category/[slug]`, `nominate`, `schools`, `get-access`, `pay`, `privacy`, `terms`.
- `client/src/components/`:
  - **Homepage:** `Hero.tsx` (rotating stories), `MoneyScene.tsx` (scroll story), `CategoryStrip.tsx`, `VocabFlips.tsx` (rope cards), `StarsSection.tsx`, `LeaderboardSection.tsx`.
  - **Layout:** `Nav.tsx`, `Footer.tsx`.
  - **Stories:** `article/*` (`ArticleView`, `ArticleBody`, layout blocks).
  - **Admin:** `admin/*` (`ArticleEditor.tsx` is the story editor).
- `client/src/lib/`: `api.ts` (public API), `adminApi.ts` (admin API), `types.ts`, `categories.ts`, `pagePhotos.ts` + `storyAccent.ts` (Snap the pages), `imagePalette.ts`, `shrinkImage.ts`.
- **Styles:** `client/src/app/globals.css` (very big), `app/admin/admin.css`, `app/school/school.css`.
  - New styles go **at the end of `globals.css`** as a block with a comment header like `/* ===== NAME: what it is ===== */`.
  - Later blocks override earlier ones. Note the "LIVE-SITE MATCH" block, which sets headings to `text-transform:none!important`.

**Server: main places**
- `server/index.js`: the app, the JSON limit (10mb), the error handler.
- `server/route_admin/*`: admin endpoints (`articles.js`, `editions.js`, `categories.js`, …).
- `server/route_public/*`: public endpoints.
- `server/models/*`: Mongoose models. The article has `accent` (story colour), `gallery`, `homepageFeatured`, `question`, `body` and `eli10` (lists of blocks).
- `server/services/*`:
  - `storyFormatter.js`: "Paste the text" → story in the house style.
  - `pageReader.js`: "Snap the pages" → photos → story.
  - Also `categories.js`, `settings.js`, `imageStore.js` (`UPLOAD_MAX_MB`, default 20), `points.js`, `reading.js`, and others.
- **Tests:** `cd server && node --test` (70 pass right now). Keep them passing.

**Story text format (one line = one block)**
- Text → paragraph; `## Heading`; `### Sub`; `> callout box`; `- bullet`; `1. step`.
- `**bold**`, `==highlight==`, `[[vocab word]]`.
- `![caption](url)`; `@photos url | url | caption`; `@profile Name | 14 | Tags · Tags | url | url`.
- `## :bulb: Heading` puts an icon on the heading. Icons: `ballot piggy bulb robot trophy puzzle book mega shades bolt flame star ear`.

## Done so far (don't redo)
- **Homepage hero:** full screen, rotating stories, dots, 1/5 counter, "Up next", arrows and pause.
  - It keeps sliding when the mouse is over it.
  - The picture's own colours make the glow.
  - In admin, the ★ on a story puts it in the hero. Settings: `home.heroMax` and `heroSeconds`.
- **Categories = edition sections**, editable in Admin → Categories. Category cards have a running border on hover, and a big icon comes in from the bottom-right.
- **Navbar:** links grouped in the centre, dropdowns open on hover, a big mega menu.
- **Money scene** (`MoneyScene.tsx`), the scroll story before the categories:
  - The girl rises in, her thoughts pop in, then the picture breaks in two jagged halves that swing open in 3D, with pieces flying out.
  - 3 of her thoughts become 3 story cards in the edition-card style.
  - It has sound (made in the browser), follows light and dark mode, and is 380svh long.
- **Vocab Vault:** rope cards. Laptop 4×2 and phone 2×3; on laptop they open on hover.
- **NextGen Stars:** before the leaderboard, with 1 big star, 2 small stars and one "Nominate" button to `/nominate`.
- **Other:** the footer is fixed, line charts are in admin and school, the Reader "Read it your way" section is commented out, and the upload limit is 20MB.
- **Snap the pages** (Admin → Stories → New → "Start from the article"):
  - Up to 4 photos of a printed article.
  - AI copies the text, the formatter writes the story, the colour snaps to the 9 site colours, heading icons are kept, and pictures are cut out in the browser.
  - Pages are put in order by their printed section numbers, and the story colour can be changed under "Story colour".

## AI keys (in `server/.env`, never open or share this file)
- Order: **Claude → Groq → Gemini**. If one is busy or fails, the next key is used.
- Setting `PHOTO_AI=claude|groq|gemini` makes that one read photos first.
- **Groq retired its Llama models in 2026.** Current models: writing uses `openai/gpt-oss-120b`, with backups `qwen/qwen3.6-27b` and `openai/gpt-oss-20b`. Reading photos uses `qwen/qwen3.6-27b`, Groq's only model that can see pictures.
- I use **Groq** (and have a Gemini key too). Gemini's free tier is sometimes "busy"; the code now waits and tries other Gemini models.

## Rules (please follow)
1. **Never open, copy or send `server/.env`** (secrets). Skip `node_modules` and `.env` when copying.
2. **Before overwriting a file on my PC, check it.** Copy it in first, compare it with what you expect, and save with the "file changed" guard. Another chat may be working on the project at the same time, and I also edit files myself.
3. **One job per chat.** Two chats should not edit the same file at once. `globals.css`, `page.tsx` and `ArticleEditor.tsx` are the risky ones.
4. **Buttons:** keep the current `.btn` styles. I tried one site-wide button system and asked for it to be undone. Change buttons only on the pages I name.
5. Check every change on **laptop and phone**, in **light and dark mode**, with no page errors, before saving.
6. **Don't download or use photos of real public figures.** Don't invent a real child's body or face in images.
7. Write site text in short, simple, friendly English for teens.
8. After a change, tell me in a few lines what changed and what to check. Don't paste long code into the chat.

## Waiting / next
- **On hold:** a **gamification system** that will control all games in NextGen. Wait until I explain it.
- **Offered, not started:**
  - An `/arcade` page with all 6 games.
  - Fix the dead "More in the arcade" links and the "Crossword" wording.
- **Optional:** points for unlocking vocab words (I said not for now).

## How I work
- I test in my browser (`npm run dev` in `client` and `server`) and paste errors or screenshots into the chat.
- My messages are quick and may have typos, so please read for what I mean.
