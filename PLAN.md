# Vendor OTP Login – Detailed Plan

This document explains **what we’re building**, **what happens at each step**, and **how to use your own phone number** (including with ngrok when localhost is an issue).

---

## 1. What we’re building (big picture)

- **Vendor login by phone + OTP** (no password).
- **You use your own phone number**: you enter it, receive an OTP on that number, enter the OTP, and get logged in.
- **Flow**: Enter phone → Get OTP (SMS to your number) → Enter OTP → Verify → Logged in.

---

## 2. Plan in more detail (step by step)

### Step 1: Show a screen where the user enters **their** phone number

- **What you see**: A “Vendor Login” page with one input: **Phone number**.
- **Can we use our own phone number?** **Yes.** You enter the number that will receive the OTP (e.g. your personal or business mobile).
- **Format**: You can type `9876543210` (10 digits) or `919876543210` (with country code). The app normalizes it (e.g. adds `91` for India if you enter 10 digits).
- **Action**: User clicks **“Get OTP”**.

### Step 2: Send OTP to that number (MSG91 Widget)

- **What happens**: The frontend calls MSG91’s widget method `sendOtp(phone)`.
- MSG91 sends an **SMS with a 6-digit OTP** to the number you entered.
- **Your phone** (the one you typed) receives that SMS.
- **UI**: The screen switches to “Enter OTP” and shows “Code sent to &lt;your number&gt;”.

### Step 3: User enters the OTP they received

- **What you see**: An input for a 6-digit OTP and a **“Verify”** button.
- **What you do**: Type the OTP you got on your phone (the same number you entered in Step 1).
- **Other options**: **“Resend OTP”** (sends another SMS via `retryOtp`), **“Change number”** (go back to Step 1).

### Step 4: Verify OTP and complete login

- **What happens**: Frontend calls MSG91’s `verifyOtp(otp)`. MSG91 returns a **JWT (access token)** if the OTP is correct.
- Frontend sends that **JWT + your phone number** to **our backend**.
- **Backend** calls MSG91’s **verifyAccessToken** API with that JWT and our **MSG91 Auth Key**.
- If MSG91 says “valid”, backend **creates/updates the vendor user** for that phone in the database and returns success.
- **UI**: You see “You are verified. Welcome!” (logged in).

So: **first step = enter your own phone number; yes, you use your own number; the rest is Get OTP → enter OTP → verify.**

---

## 3. When localhost is an issue (use ngrok)

- **Problem**: If you open the app on your **phone** (to receive OTP on the same device), the phone’s browser cannot open `http://localhost:3000` (that’s the phone’s own localhost, not your computer).
- **Solution**: Expose your app to the internet with **ngrok**. Then you open the **ngrok URL** on your phone and use **your own phone number** there; the OTP will still go to that number.

### What to expose with ngrok

1. **Frontend (Next.js, port 3000)**  
   - So you can open the login page from your phone (or any device) at `https://xxxx.ngrok-free.app`.

2. **Backend (Go API, port 8080)**  
   - So when the page loads on your phone, it can call the API (browser will call the **public** backend URL, not localhost).

### Ngrok API key (auth)

- You need an ngrok account and an **authtoken** so ngrok can run.
- Your key: `usr_39ynBmA7vFUesTwnf6PxAexD3Et`  
  (Use this as your ngrok authtoken when configuring ngrok; see steps below.)

### Steps: run with ngrok and use your own number

**1. Install ngrok**  
- Download from https://ngrok.com/download or `brew install ngrok` (Mac).

**2. Add your authtoken (one-time)**  
```bash
ngrok config add-authtoken usr_39ynBmA7vFUesTwnf6PxAexD3Et
```
(If your ngrok dashboard shows a different authtoken format, use that instead.)

**3. Start backend and frontend on your machine**  
- Terminal 1 (backend):  
  `cd backend && export DATABASE_URL="..." && export MSG91_AUTH_KEY="..." && go run ./cmd/server`  
- Terminal 2 (frontend):  
  `cd frontend && npm run dev`

**4. Start two ngrok tunnels**  
- Terminal 3 (backend):  
  `ngrok http 8080`  
  → Note the HTTPS URL, e.g. `https://abc123.ngrok-free.app`  
- Terminal 4 (frontend):  
  `ngrok http 3000`  
  → Note the HTTPS URL, e.g. `https://def456.ngrok-free.app`

**5. Point frontend to the public backend**  
- In `frontend/.env.local` set:  
  `NEXT_PUBLIC_API_URL=https://abc123.ngrok-free.app`  
  (use the **backend** ngrok URL from step 4).  
- Restart the frontend (`npm run dev`).

**6. Open the app on your phone**  
- On your phone’s browser, open the **frontend** ngrok URL: `https://def456.ngrok-free.app`.  
- **First step**: Enter **your own phone number** (the one that will receive the OTP).  
- Click **Get OTP** → receive SMS on that number → enter OTP → **Verify** → you’re in.

So: **yes, you use your own phone number**; when localhost is an issue, use ngrok for both frontend and backend and set `NEXT_PUBLIC_API_URL` to the backend ngrok URL.

---

## 4. Summary table

| Step | What you see / do | What happens behind the scenes |
|------|-------------------|----------------------------------|
| 1    | Enter **your** phone number → **Get OTP** | Frontend: `sendOtp(phone)`. MSG91 sends SMS to that number. |
| 2    | Screen: “Enter OTP” | You receive SMS; you type the OTP. |
| 3    | Click **Verify** (or **Resend OTP** / **Change number**) | Frontend: `verifyOtp(otp)` → gets JWT → calls our backend with JWT + phone. Backend: MSG91 verifyAccessToken → create/update user → success. |
| 4    | “You are verified. Welcome!” | You are logged in as that vendor (phone stored in DB). |

**First step = enter your own phone number. You can use your own number; if you’re not on the same machine as the app, use ngrok and open the frontend ngrok URL (e.g. on your phone) and set `NEXT_PUBLIC_API_URL` to the backend ngrok URL.**
