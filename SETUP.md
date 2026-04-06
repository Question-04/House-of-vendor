# Setup checklist – what to create and what values to put

Do these in order. Replace every `PUT_YOUR_...` with your real value.

---

## 1. Create backend env file

**Create this file:**  
`Vendor/backend/.env`

**Put this inside (then replace the placeholders):**

```env
# PostgreSQL – replace with your DB user, password, and DB name
DATABASE_URL=postgres://PUT_YOUR_DB_USER:PUT_YOUR_DB_PASSWORD@localhost:5432/PUT_YOUR_DB_NAME?sslmode=disable

# Optional, default is 8080
PORT=8080

# MSG91 Auth Key (from MSG91 dashboard → Auth Keys / same as "Select Authkey" in verifyAccessToken)
MSG91_AUTH_KEY=PUT_YOUR_MSG91_AUTH_KEY
```

**What to put:**

| Placeholder | Where to get it | Example |
|-------------|-----------------|--------|
| `PUT_YOUR_DB_USER` | Your PostgreSQL username | `postgres` or `macpro` |
| `PUT_YOUR_DB_PASSWORD` | Your PostgreSQL password | `mypassword` |
| `PUT_YOUR_DB_NAME` | Name of the database you created | `vendor_db` |
| `PUT_YOUR_MSG91_AUTH_KEY` | MSG91 dashboard → Auth Keys (e.g. houseofplutus key) | `495508AIgm3nKi9069999389P1` |

**Example after you fill it:**

```env
DATABASE_URL=postgres://postgres:mypassword@localhost:5432/vendor_db?sslmode=disable
PORT=8080
MSG91_AUTH_KEY=495508AIgm3nKi9069999389P1
```

---

## 2. Create frontend env file

**Create this file:**  
`Vendor/frontend/.env.local`

**Put this inside (then replace the placeholders):**

```env
# Backend API URL
# – Local only: http://localhost:8080
# – With ngrok: use the BACKEND ngrok URL (from "ngrok http 8080"), e.g. https://xxxx.ngrok-free.app
NEXT_PUBLIC_API_URL=PUT_YOUR_BACKEND_URL

# MSG91 OTP Widget (from MSG91 dashboard → OTP Widget)
NEXT_PUBLIC_MSG91_WIDGET_ID=PUT_YOUR_WIDGET_ID
NEXT_PUBLIC_MSG91_TOKEN_AUTH=PUT_YOUR_TOKEN_AUTH
```

**What to put:**

| Placeholder | Where to get it | Example |
|-------------|-----------------|--------|
| `PUT_YOUR_BACKEND_URL` | Without ngrok: `http://localhost:8080`. With ngrok: the HTTPS URL from `ngrok http 8080` (no trailing slash) | `http://localhost:8080` or `https://abc123.ngrok-free.app` |
| `PUT_YOUR_WIDGET_ID` | MSG91 dashboard → OTP Widget → Widget ID | `366274716244313138363332` |
| `PUT_YOUR_TOKEN_AUTH` | MSG91 dashboard → same OTP Widget → Token / Token Auth | (string from widget config) |

**Example (local only):**

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_MSG91_WIDGET_ID=366274716244313138363332
NEXT_PUBLIC_MSG91_TOKEN_AUTH=your_actual_token_from_msg91
```

**Example (with ngrok):**

```env
NEXT_PUBLIC_API_URL=https://abc123.ngrok-free.app
NEXT_PUBLIC_MSG91_WIDGET_ID=366274716244313138363332
NEXT_PUBLIC_MSG91_TOKEN_AUTH=your_actual_token_from_msg91
```

---

## 3. Database (one-time)

Create the database and table.

**Commands (replace `vendor_db` if you used another name):**

```bash
# Create database (use your PostgreSQL user if needed)
createdb vendor_db

# Run migration (path from project root Vendor/)
psql -d vendor_db -f backend/migrations/001_create_vendor_users.sql
```

If `psql` asks for a password, use `PUT_YOUR_DB_PASSWORD` from step 1.

---

## 4. Ngrok (one-time setup + when testing from phone)

**4.1 Install ngrok**

- Mac: `brew install ngrok`
- Or download: https://ngrok.com/download

**4.2 Add your authtoken (one-time)**

Run this once (you gave this key):

```bash
ngrok config add-authtoken usr_39ynBmA7vFUesTwnf6PxAexD3Et
```

**4.3 When you want to test from your phone**

1. Start backend and frontend on your machine (see section 5).
2. Open **two extra terminals** and run:
   - Terminal A: `ngrok http 8080`  
     → Copy the **HTTPS** URL (e.g. `https://abc123.ngrok-free.app`). This is your **backend** URL.
   - Terminal B: `ngrok http 3000`  
     → Copy the **HTTPS** URL (e.g. `https://def456.ngrok-free.app`). This is your **frontend** URL.
3. In `Vendor/frontend/.env.local` set:
   ```env
   NEXT_PUBLIC_API_URL=https://abc123.ngrok-free.app
   ```
   (use the URL from Terminal A, **no trailing slash**.)
4. Restart the frontend (stop `npm run dev` and run it again).
5. On your **phone**, open the URL from **Terminal B** (e.g. `https://def456.ngrok-free.app`), enter your phone number → Get OTP → enter OTP → Verify.

---

## 5. Run the app (daily)

**Terminal 1 – Backend**

```bash
cd Vendor/backend
go run ./cmd/server
```

If you created `backend/.env`, it is loaded automatically. If not, set vars before running:

```bash
cd Vendor/backend
export DATABASE_URL="postgres://postgres:mypassword@localhost:5432/vendor_db?sslmode=disable"
export MSG91_AUTH_KEY="495508AIgm3nKi9069999389P1"
go run ./cmd/server
```

**Terminal 2 – Frontend**

```bash
cd Vendor/frontend
npm install
npm run dev
```

- **Local:** Open http://localhost:3000  
- **From phone:** Use the **frontend** ngrok URL (and set `NEXT_PUBLIC_API_URL` to the **backend** ngrok URL as in section 4).

---

## Quick reference – files you create

| File | Purpose |
|------|--------|
| `Vendor/backend/.env` | Backend: database URL + MSG91 auth key |
| `Vendor/frontend/.env.local` | Frontend: backend URL + MSG91 widget ID + token auth |

**Values you must get from MSG91:**

- **MSG91 Auth Key** → `backend/.env` → `MSG91_AUTH_KEY`
- **Widget ID** → `frontend/.env.local` → `NEXT_PUBLIC_MSG91_WIDGET_ID`
- **Token Auth** → `frontend/.env.local` → `NEXT_PUBLIC_MSG91_TOKEN_AUTH`

**Ngrok:**

- Authtoken (one-time): `ngrok config add-authtoken usr_39ynBmA7vFUesTwnf6PxAexD3Et`
- When using ngrok: put **backend** ngrok URL in `NEXT_PUBLIC_API_URL` in `frontend/.env.local`, then open **frontend** ngrok URL on your phone.
