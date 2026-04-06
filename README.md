# Vendor Website – OTP Login (MSG91 Widget)

Vendor login using **phone number + OTP** with **MSG91 OTP Widget** (client-side sendOtp / retryOtp / verifyOtp) and server-side **verifyAccessToken**.  
**Frontend:** Next.js · **Backend:** Go · **OTP:** MSG91 Widget + Control API

---

## Keys to put where

### 1. MSG91 Dashboard

- Log in at **https://msg91.com** (or **https://control.msg91.com**).
- Create or open an **OTP Widget** and note:
  - **Widget ID** (e.g. `366274716244313138363332`)
  - **Token Auth** (the token you use in the widget config; sometimes named “Token” or “Auth token” in the widget setup)
- In the same account, open **Auth Keys** (or API / SendOTP section) and select the auth key you use for this widget (e.g. **houseofplutus**). Copy the **Auth Key** value (e.g. `495508AIgm3nKi9069999389P1`).

### 2. Backend (Go) – `.env` or `export`

| Key | Where to put | Example |
|-----|----------------|--------|
| **Auth Key** (for verifyAccessToken) | `MSG91_AUTH_KEY` | `495508AIgm3nKi9069999389P1` |
| Database URL | `DATABASE_URL` | `postgres://user:pass@localhost:5432/vendor_db?sslmode=disable` |

So in the backend you put the **same auth key** you selected in the dropdown when using the “verify access token” API (e.g. houseofplutus key).

### 3. Frontend (Next.js) – `.env.local`

| Key | Where to put | Example |
|-----|----------------|--------|
| **Widget ID** | `NEXT_PUBLIC_MSG91_WIDGET_ID` | `366274716244313138363332` |
| **Token Auth** (widget token) | `NEXT_PUBLIC_MSG91_TOKEN_AUTH` | Your widget token from MSG91 |
| Backend API URL | `NEXT_PUBLIC_API_URL` | `http://localhost:8080` |

Copy `.env.local.example` to `.env.local` and replace the placeholder values with your Widget ID and Token Auth.

---

## How to run (step by step)

### 1. Database (PostgreSQL)

```bash
createdb vendor_db
psql -d vendor_db -f backend/migrations/001_create_vendor_users.sql
psql -d vendor_db -f backend/migrations/002_create_vendor_phone_login_success.sql
```

### 2. Backend

```bash
cd backend
export DATABASE_URL="postgres://user:password@localhost:5432/vendor_db?sslmode=disable"
export MSG91_AUTH_KEY="495508AIgm3nKi9069999389P1"   # your auth key from dropdown
go mod tidy
go run ./cmd/server
```

Server runs at **http://localhost:8080**.

### 3. Frontend

```bash
cd frontend
cp .env.local.example .env.local
# Edit .env.local:
#   NEXT_PUBLIC_MSG91_WIDGET_ID=<your widget id>
#   NEXT_PUBLIC_MSG91_TOKEN_AUTH=<your widget token auth>
#   NEXT_PUBLIC_API_URL=http://localhost:8080  (if backend is on 8080)
npm install
npm run dev
```

Open **http://localhost:3000**.

### 4. Test the flow

1. **First step**: Enter **your own phone number** (the one that will receive the OTP), e.g. `9876543210` or `919876543210` → **Get OTP** (uses `window.sendOtp`).
2. Enter the OTP you received on that phone → **Verify** (uses `window.verifyOtp`, then our server calls MSG91 verifyAccessToken).
3. If you don’t get SMS → **Resend OTP** (uses `window.retryOtp`).

**Yes, you use your own phone number** – that’s the number that gets the OTP and is stored as the vendor.

---

## Testing from your phone (ngrok)

If you want to open the app **on your phone** (so you can enter your number and get the OTP on the same device), localhost won’t work. Use **ngrok** to expose both frontend and backend:

1. **Install ngrok**: https://ngrok.com/download or `brew install ngrok`
2. **Add your ngrok authtoken** (one-time):  
   `ngrok config add-authtoken usr_39ynBmA7vFUesTwnf6PxAexD3Et`
3. **Start backend** (port 8080) and **frontend** (port 3000) on your machine as above.
4. **Two terminals for ngrok**:  
   - `ngrok http 8080` → note the HTTPS URL (e.g. `https://abc123.ngrok-free.app`)  
   - `ngrok http 3000` → note the HTTPS URL (e.g. `https://def456.ngrok-free.app`)
5. In **frontend** `.env.local` set:  
   `NEXT_PUBLIC_API_URL=https://abc123.ngrok-free.app`  
   (use the **backend** ngrok URL from step 4). Restart frontend.
6. On your **phone**, open the **frontend** ngrok URL (e.g. `https://def456.ngrok-free.app`), enter **your phone number** → Get OTP → enter OTP → Verify.

For a fuller explanation of the plan and each step, see **[PLAN.md](./PLAN.md)**.

---

## What key to put in the “Select Authkey” / verifyAccessToken call

- In MSG91 docs you see: **Select Authkey** → e.g. **houseofplutus**, and the request body uses `"authkey": "495508AIgm3nKi9069999389P1"`.
- **Put that same auth key** in your **server** as `MSG91_AUTH_KEY`. The backend uses it only for:

  `POST https://control.msg91.com/api/v5/widget/verifyAccessToken`  
  with body: `{ "authkey": "<MSG91_AUTH_KEY>", "access-token": "<jwt_from_widget>" }`.

- So: **Auth Key** = value from the dropdown (e.g. houseofplutus key) → set as **`MSG91_AUTH_KEY`** in the backend. No key is needed in the frontend for verify; the frontend only needs **Widget ID** and **Token Auth** for the widget.

---

## Flow summary

1. **Frontend** loads MSG91 script with `exposeMethods: true` (no popup), and your custom UI.
2. User enters phone → **Get OTP** → `window.sendOtp(phone, onSuccess, onFailure)`.
3. User doesn’t get SMS → **Resend OTP** → `window.retryOtp(null, onSuccess, onFailure)`.
4. User enters OTP → **Verify** → `window.verifyOtp(otp, onSuccess, onFailure)`. On success, the callback receives a **JWT (access token)**.
5. Frontend sends that **access token + phone** to our backend: `POST /api/verify-token` with `{ "accessToken": "<jwt>", "phone": "919876543210" }`.
6. **Backend** calls MSG91:  
   `POST https://control.msg91.com/api/v5/widget/verifyAccessToken`  
   with `{ "authkey": "<MSG91_AUTH_KEY>", "access-token": "<jwt>" }`.  
   If MSG91 returns success, backend creates/updates the vendor user by phone and returns success.

---

## API endpoints (backend)

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/api/verify-token` | `{"accessToken":"<jwt>","phone":"919876543210"}` | Verify widget JWT (MSG91 verifyAccessToken), then create/update user |
| POST | `/api/send-otp` | `{"phone":"..."}` | Legacy/magic OTP (optional) |
| POST | `/api/verify-otp` | `{"phone":"...","otp":"..."}` | Legacy/magic OTP (optional) |
| POST | `/api/resend-otp` | `{"phone":"..."}` | Legacy/magic OTP (optional) |
| GET | `/api/health` | - | Health check |

For the **widget flow**, only **`/api/verify-token`** is required; the others are for the old/magic OTP flow if you keep it.

---

## Database

Run both migrations:

```sql
CREATE TABLE IF NOT EXISTS vendor_users (
    id         BIGSERIAL PRIMARY KEY,
    phone      VARCHAR(20) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vendor_users_phone ON vendor_users(phone);

CREATE TABLE IF NOT EXISTS vendor_phone_login_success (
    id             BIGSERIAL PRIMARY KEY,
    vendor_user_id BIGINT NOT NULL REFERENCES vendor_users(id) ON DELETE CASCADE,
    phone          VARCHAR(20) NOT NULL UNIQUE,
    vendor_code    VARCHAR(6) NOT NULL UNIQUE,
    login_status   VARCHAR(20) NOT NULL DEFAULT 'success',
    login_source   VARCHAR(30) NOT NULL DEFAULT 'phone_otp',
    verified_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Env summary

**Backend**

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL DSN |
| `MSG91_AUTH_KEY` | Yes (for widget verify) | Auth key from MSG91 (same as “Select Authkey” in verifyAccessToken) |
| `PORT` | No | Default `8080` |

**Frontend**

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_MSG91_WIDGET_ID` | Yes | Widget ID from MSG91 OTP Widget |
| `NEXT_PUBLIC_MSG91_TOKEN_AUTH` | Yes | Token Auth from same widget |
| `NEXT_PUBLIC_API_URL` | No | Backend URL, default `http://localhost:8080` |

---

## Project layout

```
Vendor/
├── backend/
│   ├── cmd/server/main.go
│   ├── internal/
│   │   ├── config/
│   │   ├── db/
│   │   ├── handler/          # verify_token.go (widget), otp.go (legacy)
│   │   └── msg91/            # client.go (legacy), widget.go (verifyAccessToken)
│   └── migrations/
├── frontend/
│   └── src/
│       ├── app/page.tsx      # Login UI using sendOtp/retryOtp/verifyOtp
│       ├── lib/api.ts        # verifyToken(), etc.
│       ├── lib/msg91-widget.ts
│       └── types/msg91.d.ts
└── README.md
```
