# How vendor OTP login works

End-to-end flow in simple steps.

---

## 1. You enter your phone number

- You type the number that will receive the SMS (e.g. `9911740331` or `919911740331`).
- The app normalizes it (e.g. adds `91` for India if you enter 10 digits).
- You click **Get OTP**.

---

## 2. Get OTP (frontend → MSG91)

- The frontend calls **MSG91’s widget** method: `sendOtp(phone)`.
- MSG91 sends an **SMS with a 6-digit OTP** to that number.
- No request goes to our backend here; it’s between your browser and MSG91.
- The screen switches to **Enter OTP**.

---

## 3. You enter the OTP and click Verify

- You type the 6-digit code you received.
- You click **Verify**.
- The UI immediately shows **“Verifying OTP…”** with a spinner, then **“Almost there…”** when the OTP is accepted and we’re checking with our server.

---

## 4. Verify OTP (frontend → MSG91, then frontend → our backend)

**Step A – Check OTP with MSG91**

- The frontend calls the widget: `verifyOtp(otp)`.
- MSG91 checks the OTP. If it’s correct, they return a **JWT (access token)** in the `message` field.
- Our app reads that token and shows **“Almost there…”**.

**Step B – Verify token on our server**

- The frontend sends that **JWT + your phone number** to our backend:  
  `POST /api/verify-token` with `{ "accessToken": "<jwt>", "phone": "919911740331" }`.
- Our backend calls **MSG91’s API**:  
  `POST https://control.msg91.com/api/v5/widget/verifyAccessToken`  
  with `{ "authkey": "<our MSG91 auth key>", "access-token": "<jwt>" }`.
- If MSG91 says the token is valid, our backend **creates or updates the vendor user** for that phone in the database and returns success.
- The frontend then shows **“You are verified. Welcome!”**.

---

## 5. Summary

| Step | Who does what |
|------|----------------|
| Enter phone → Get OTP | Frontend calls MSG91 widget `sendOtp(phone)`. MSG91 sends SMS. |
| Enter OTP → Verify | Frontend calls widget `verifyOtp(otp)` → gets JWT. |
| Verify (server) | Frontend sends JWT + phone to our backend. Backend calls MSG91 verifyAccessToken, then saves/updates user. |

The slight delay on Verify is from: (1) MSG91 checking the OTP and returning the JWT, and (2) our backend calling MSG91 again and writing to the database. We can’t make MSG91 faster, but the UI now shows **“Verifying OTP…”** and **“Almost there…”** so it feels responsive and it’s clear that something is happening.
