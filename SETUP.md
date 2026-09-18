# First-time setup

Follow these in order. Steps 1–4 can be done by anyone; **step 5 needs someone with
DNS access to `giisclubs.org`**, so start that one early — it is the step most
likely to hold you up.

---

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free project.
2. Open **SQL Editor** in the left sidebar.
3. Paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql) and press **Run**.
4. Optional, for testing only: run [`supabase/seed_example.sql`](supabase/seed_example.sql)
   to add three dummy attendees. **Change the email addresses in that file first**
   — otherwise the "send tickets" button will email strangers.

Then find your keys under **Project Settings → API**:

- **Project URL** → `SUPABASE_URL`
- **`service_role` key** (not `anon`) → `SUPABASE_SERVICE_ROLE_KEY`

> The `service_role` key bypasses all database security. It is only ever read by
> server-side code in this app. Never paste it into a file whose name starts with
> `NEXT_PUBLIC_`, and never commit it.

---

## 2. Import your attendees

The app does not have an import screen. Add attendees with Supabase's **Table
Editor → attendees → Insert**, or paste a query into the SQL Editor:

```sql
insert into attendees (idnum, name, email) values
  ('10423', 'Aarav Mehta', 'aarav@example.com'),
  ('10424', 'Priya Raghavan', 'priya@example.com');
```

If you have a spreadsheet, Supabase's Table Editor has an **Import data from CSV**
option. Your CSV needs exactly three columns: `idnum`, `name`, `email`.

`idnum` must be unique, and it is the number that ends up inside each person's QR
code. Currently it must be **digits only** — see "Changing the ID format" below if
your IDs contain letters.

---

## 3. Set up environment variables

Copy `.env.example` to `.env.local` and fill it in:

```bash
cp .env.example .env.local
```

| Variable                    | What it is                                                |
|-----------------------------|-----------------------------------------------------------|
| `SUPABASE_URL`              | From step 1                                               |
| `SUPABASE_SERVICE_ROLE_KEY` | From step 1 — server-side only                            |
| `APP_PASSWORD`              | A password you invent. Staff type it once per device      |
| `TICKET_LINK_SECRET`        | Run `openssl rand -hex 32` and paste the output            |
| `EMAIL_PROVIDER`            | `resend` or `brevo`                                       |
| `EMAIL_API_KEY`             | From step 4                                               |
| `EMAIL_SMTP_USER`           | Brevo only — leave blank for Resend                       |
| `EMAIL_FROM`                | `sustainabilitysphere@giisclubs.org`                      |
| `EVENT_NAME` / `EVENT_DATE` / `EVENT_LOCATION` | Shown on the ticket email      |
| `EVENT_START_ISO` / `EVENT_END_ISO` | Optional — real ISO datetime (e.g. `2026-10-04T09:00:00+08:00`). Set `EVENT_START_ISO` to add an "Add to Calendar" button + `.ics` attachment; leave blank to skip. `EVENT_END_ISO` defaults to 3 hours later. |

**About `APP_PASSWORD`:** without it, anyone who finds your web address can mark
attendees as present and email your entire attendee list. Make it long, share it
with your volunteers, and change it after the event.

**About `TICKET_LINK_SECRET`:** this signs the manual ticket link described in
step 8 below. It has nothing to do with `APP_PASSWORD` — don't reuse the same
value for both. Once set, don't change it mid-event: any links already sent out
would stop working.

---

## 4. Pick an email provider

Both options below are free and both require the same DNS work in step 5. Build
with one; switching later is just an env-var change.

| | Resend | Brevo |
|---|---|---|
| Free tier | ~100/day, 3,000/month | ~300/day |
| `EMAIL_PROVIDER` | `resend` | `brevo` |
| `EMAIL_API_KEY` | API key starting `re_` | your SMTP key |
| `EMAIL_SMTP_USER` | leave blank | the login they show you, like `8xxxxx@smtp-brevo.com` |

**Pick Brevo if you have more than 100 attendees**, otherwise sending will take
more than one day.

---

## 5. Verify the sending domain  ⚠️ needs DNS access

This is an IT/admin task, not a coding one. Whoever controls DNS for
`giisclubs.org` has to add records that your email provider gives you:

- **SPF** — says your provider is allowed to send as `giisclubs.org`
- **DKIM** — cryptographically signs each message
- **DMARC** — tells receiving servers what to do when a message fails the above

Your provider's dashboard generates the exact records to add; they are copy-paste.
Verification usually completes within an hour but can take up to 24.

**You cannot skip this.** Without it, mail from `sustainabilitysphere@giisclubs.org`
will go to spam for most recipients, or be rejected outright. If you cannot get
DNS access in time, the fallback is to send from a domain you do control.

---

## 6. Add the sound files

The two sounds are not in this repository — they are yours to supply:

- `public/sfx/mogo.mp3` — plays on a successful scan
- `public/sfx/mono.mp3` — plays on any failure

Use those exact filenames. Keep both under about a second so they finish before
the next person steps up. If either file is missing the app still works, just
silently — nothing crashes.

---

## 7. Add the club logo

Save the logo as `public/logo.png`. It gets embedded in the ticket email.

Make it roughly 200×200 and under 100 KB. A transparent background works well
against the dark teal header. If the file is missing the email still sends,
without a logo.

---

## 8. Manual ticket fallback (in case an email fails)

Every attendee also has a private ticket page that doesn't depend on email at
all: `/ticket/{idnum}/{a long signed code}`. It shows the same ticket — name,
QR code, ID — and has a **Download ticket as image** button that saves a PNG
you can AirDrop, text, or WhatsApp directly.

You never type this link by hand. On `/admin`, press **Manual ticket** next to
any attendee's name — it appears inline with **Copy** and **Open** buttons.
Use this when:

- an email bounces or lands somewhere the attendee can't find it
- someone lost their ticket and needs a replacement on the spot
- you want to hand someone their ticket directly from your own phone, no
  internet round-trip to an inbox required

The link only works for that one attendee — it's cryptographically signed with
`TICKET_LINK_SECRET`, so nobody can guess another person's link by changing the
ID in the URL. It does **not** expire and does **not** require the `APP_PASSWORD`,
because the attendee opens it directly, not a staff member.

---

## 9. Run it locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

A quick check that everything is wired up:

1. Go to `/admin` — if the counts load, Supabase is connected.
2. Find a test attendee whose email you control, press **Send ticket**, and confirm
   the email arrives with the QR code visible in the body.
3. Open that email on your phone, open the scanner, and scan it. You should get a
   green screen with the name and email.
4. Scan the same code again. You should get a red "already checked in" screen.
5. Flip the toggle to **Food collection** and scan the same code. Green again,
   because food is tracked separately.

> The camera only works over HTTPS or on `localhost`. If you want to test from your
> phone against your laptop, deploy to Vercel first (step 10) rather than using
> your laptop's local IP address — browsers block the camera on plain `http://`.

---

## 10. Deploy to Vercel

1. Push this project to GitHub.
2. At [vercel.com](https://vercel.com), **Add New → Project**, and import the repo.
3. Before deploying, open **Environment Variables** and add every variable from
   your `.env.local`. This is the step people forget — the build will succeed
   without them and then fail at runtime.
4. Deploy.

HTTPS is automatic on Vercel, which is what makes the phone camera work.

---

## During the event

- Every volunteer opens the same URL and types the `APP_PASSWORD` once.
- **Each device picks its own mode.** The Registration/Food toggle is stored on
  that phone only, so you can have two people on the door in Registration mode and
  two at the food table in Food mode at the same time. Flipping one does not
  change the others — check each device is in the right mode before you start.
- If a phone's camera fails, press **Enter an ID by hand** and type the number.
- `/admin` shows live counts and lets you resend a ticket to anyone who lost theirs.
- If someone's email never arrives, press **Manual ticket** on their row instead
  of troubleshooting email — it gets them a working QR code immediately.

---

## Changing the ID format

IDs are currently digits only. If yours contain letters, edit one line in
[`src/lib/qr.ts`](src/lib/qr.ts):

```ts
const ID_PATTERN = "\\d+";              // before
const ID_PATTERN = "[A-Za-z0-9._-]+";   // after
```

Then run `npm test` to confirm the validation still behaves as you expect, and
redeploy. Nothing else needs to change.

---

## Troubleshooting

**"APP_PASSWORD is not set on the server"** — you deployed without setting it in
Vercel's environment variables. Add it and redeploy.

**"Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"** — same cause:
the variables exist in your local `.env.local` but were never added to Vercel.
Add them under Project Settings → Environment Variables, then redeploy. Vercel does
not pick up new variables until the next deploy.

**Emails land in spam** — step 5 is incomplete. Check the provider dashboard says
the domain is verified, and that DMARC is present, not just SPF and DKIM.

**"Ticket already sent"** — that attendee already has one. The admin page's
**Resend** button on their row sends it again deliberately.

**Sending stops partway through** — the free tier's daily cap. Wait until it resets
and press the send button again; already-sent people are skipped automatically.

**"TICKET_LINK_SECRET is not set on the server"** — same cause as the two errors
above: add it in Vercel's Environment Variables and redeploy.

**A manual ticket link says "not valid"** — either it was copied incorrectly (it's
long; copy the whole thing, don't retype it), or `TICKET_LINK_SECRET` was changed
after the link was generated. Press **Manual ticket** again to get a fresh one.

**The camera never starts** — check the address bar says `https://`, then check
the browser's site permissions for camera access.
