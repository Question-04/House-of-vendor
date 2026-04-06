# Troubleshooting: "Server verification failed" / 404 on verify-token

## 1. Fix 404 on `verify-token` (main issue)

**Symptom:** Network tab shows `verify-token` request with **404 page not found**.

**Cause:** The browser is calling the **wrong server**. Either the Go backend is not running, or the frontend is calling Next.js (same origin) instead of the Go API.

**Do this:**

1. **Start the Go backend** (must be running when you click Verify):
   ```bash
   cd Vendor/backend
   go run ./cmd/server
   ```
   You should see: `Vendor API listening on :8080`

2. **Point the frontend to the backend** in `Vendor/frontend/.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8080
   ```
   - No trailing slash.
   - Use `8080` (backend port), **not** `3001` (frontend port).

3. **Restart the frontend** after changing `.env.local`:
   ```bash
   cd Vendor/frontend
   npm run dev
   ```

4. In the browser Network tab, confirm the **Request URL** for `verify-token` is  
   `http://localhost:8080/api/verify-token`  
   and not `http://localhost:3001/api/verify-token`.

---

## 2. Which key to put where (Token vs Auth Key)

MSG91 uses **two different values**. Don’t mix them.

| Where | What to use | Where you see it in MSG91 |
|--------|-------------|----------------------------|
| **Frontend** `.env.local` → `NEXT_PUBLIC_MSG91_TOKEN_AUTH` | **Widget Token** (Token value) | OTP → **Tokens** table → column **Value** (e.g. `495508TE6Y19d0uZHa6999c2bfP1` for "new", or `495508THsEVVrc66999918eP1` for "houseofplutus") |
| **Backend** `.env` → `MSG91_AUTH_KEY` | **Auth Key** (for verifyAccessToken API) | OTP Widget → **Integration** → **Server Side Integration** → **Select Authkey** → copy the **authkey** value from the **Curl** example (e.g. `495508ASzHXKUmLUII6999c2a3P1`) |

- **Tokens** page (S No., Name, Value, Status): the **Value** is the **Widget Token** → use in **frontend** only.
- **Integration** page (Select Authkey, Curl): the **authkey** in the curl is the **Auth Key** → use in **backend** only.

**Example:**

- You created a token named **"new"** with Value `495508TE6Y19d0uZHa6999c2bfP1`.
- On Integration, you selected Authkey **"new"** and the curl shows `"authkey": "495508ASzHXKUmLUII6999c2a3P1"`.

Then set:

- **Frontend** `.env.local`:  
  `NEXT_PUBLIC_MSG91_TOKEN_AUTH=495508TE6Y19d0uZHa6999c2bfP1`  
  (Token Value from Tokens table for the token you use in the widget.)

- **Backend** `.env`:  
  `MSG91_AUTH_KEY=495508ASzHXKUmLUII6999c2a3P1`  
  (Auth key from the **Curl** on the Integration page when that Authkey is selected.)

If the Curl shows a different authkey when you select "new", use that exact value in `MSG91_AUTH_KEY`. The Auth Key and the Token Value are often **different**; that is normal.

---

## 3. Checklist

- [ ] Go backend is running on port 8080.
- [ ] `Vendor/frontend/.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:8080`.
- [ ] Frontend was restarted after changing `.env.local`.
- [ ] `NEXT_PUBLIC_MSG91_TOKEN_AUTH` = Token **Value** from MSG91 **Tokens** table.
- [ ] `MSG91_AUTH_KEY` (backend) = **authkey** from MSG91 **Integration** page Curl (Server Side Integration).
