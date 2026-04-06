# Caching, Navigation & Multi-Query Loading — Full Spec

Use this so **data stays loaded** when you switch pages and come back, **loads fast** (cache-first), and **multiple queries don’t fail** when some succeed and some don’t.

---

## 1. How It Works (Summary)

| Behavior | How it’s done |
|----------|----------------|
| **Go to another page and come back** | Data stays loaded because Apollo uses **in-memory cache** and **cache-first**. No refetch unless you force it or cache is empty. |
| **Fast first load** | **cache-first**: if data is in cache, show it immediately. Optionally refetch in background (stale-while-revalidate). |
| **Refresh the page** | Full reload → cache can be empty → queries run again. Or use **persistent cache** (e.g. localStorage) so even after refresh you show cached data first, then refresh in background. |
| **6 queries, some load / some don’t** | Use **Promise.allSettled** (not Promise.all). Each query succeeds or fails independently. Merge results: use fulfilled data, use `[]` or default for rejected. Retry failed ones optionally. |

---

## 2. Page Switching & “Stay Loaded”

### 2.1 Apollo Client (GraphQL)

- **Single client per app** (e.g. in `_app.tsx` with `ApolloProvider`). Same client = same cache across all pages.
- **Default fetch policy: `cache-first`**  
  - First visit: no cache → request goes to network.  
  - Navigate away and back: cache hit → **no network request**, data from cache → instant.
- **When does it refetch?**  
  - Only when you use `refetch()`, or `fetchPolicy: 'network-only'` / `'no-cache'`, or when the cache was evicted.  
  - So: **coming back to a page = use cache = stay loaded, no refetch.**

**Apollo default options (example):**

```ts
// In your Apollo Client setup (e.g. apolloClient.ts)
defaultOptions: {
  watchQuery: {
    errorPolicy: 'all',
    fetchPolicy: 'cache-first',
    nextFetchPolicy: 'cache-first',
  },
  query: {
    errorPolicy: 'all',
    fetchPolicy: 'cache-first',
  },
},
```

- **cache-first** = read from cache first; only hit network if the query isn’t in cache.
- **errorPolicy: 'all'** = you still get partial data even if some fields error (optional; use if you want to show what loaded).

### 2.2 Persisting Across Refresh (Optional)

- **In-memory cache** is lost on full page refresh.
- To “stay loaded” even after refresh:
  - **Option A:** Persist Apollo cache (e.g. `apollo3-cache-persist` with localStorage).
  - **Option B:** Your own **persistent cache** (e.g. localStorage): on load, try cache first and render; then fetch fresh data and replace cache.

Example pattern (conceptual):

- On mount: read from `localStorage` (or similar). If present and not expired → set state with cached data (instant).
- Then call API. On success → update state and write to cache. So: **cached data first, then new data when it loads**.

---

## 3. When Data Is Loaded vs Refetched

| Event | What happens |
|-------|----------------|
| First visit to page | No cache → run query → store in Apollo cache → render. |
| Navigate to another page | Component unmounts; **cache is kept**. |
| Come back to page | Component mounts → Apollo runs query with `cache-first` → **cache hit** → render from cache, **no network**. |
| Full page refresh | In-memory cache cleared → queries run again. (Unless you use persistent cache, then show cache first, then refetch.) |
| You want fresh data | Use `refetch()` or a fetch policy like `network-only` for that one request. |

So: **coming back = still loaded from cache; only refresh (or explicit refetch) triggers load again.**

---

## 4. Multiple Queries (6 at Once) — Don’t Let One Failure Break Others

### 4.1 Use `Promise.allSettled` (Not `Promise.all`)

- **Promise.all**: one rejected → whole thing rejects → you might show nothing or one error.
- **Promise.allSettled**: each promise settles (fulfilled or rejected). You handle each result: use data where fulfilled, use default (e.g. `[]`) where rejected.

Example (6 queries, e.g. 6 categories):

```ts
const [r1, r2, r3, r4, r5, r6] = await Promise.allSettled([
  client.query({ query: QUERY_1, variables: { ... } }),
  client.query({ query: QUERY_2, variables: { ... } }),
  client.query({ query: QUERY_3, variables: { ... } }),
  client.query({ query: QUERY_4, variables: { ... } }),
  client.query({ query: QUERY_5, variables: { ... } }),
  client.query({ query: QUERY_6, variables: { ... } }),
]);

const data1 = r1.status === 'fulfilled' ? r1.value.data : null;
const data2 = r2.status === 'fulfilled' ? r2.value.data : null;
// ... same for r3..r6

// Use data1..data6; where status === 'rejected', use [] or default and optionally log r.reason
```

So: **all 6 run; whichever succeed you use; for failed ones you use fallback and optionally retry.**

### 4.2 Retries (So More Queries Succeed)

- **Apollo**: use `RetryLink` with a few attempts (e.g. 3) and jittered delay (e.g. 500ms, 1s, 2s). Retry on network errors (and optionally on 5xx).
- **REST/fetch**: wrap in a small retry loop (e.g. 2–3 retries with delay). Then pass the result into the same “fulfilled / rejected” handling as above (e.g. inside allSettled).

Result: **transient failures get retried; after retries, you still only use successful results and defaults for failed ones**, so the UI always has something to show.

### 4.3 One Query Failing Should Not Break the Page

- Never rely on “all 6 must succeed”. Always:
  - Use allSettled (or equivalent per-query try/catch).
  - Merge: `dataCategory1 = result1 ?? []`, etc.
  - Show what loaded; for failed categories show empty list or a small “Couldn’t load” message.

---

## 5. Implementation Checklist (Other Website)

Apply this on the **other** site so behavior matches:

1. **Single data client**  
   One Apollo Client (or one React Query client, etc.) for the whole app, provided at the root (e.g. `_app` or `Layout`). Same client = shared cache across pages.

2. **Cache-first as default**  
   Set default `fetchPolicy: 'cache-first'` (and `nextFetchPolicy: 'cache-first'` for watchQuery if using Apollo). So when user comes back to a page, data is read from cache and stays loaded.

3. **Navigation**  
   Use client-side navigation (e.g. Next.js `<Link>` / `router.push`). Don’t do full page reloads for in-app links so the in-memory cache is preserved.

4. **Multiple queries (e.g. 6)**  
   - Run them with **Promise.allSettled** (or 6 independent useQuery hooks with error boundaries / fallbacks).  
   - Merge: fulfilled → use data; rejected → use `[]` or default.  
   - Add retries (Apollo RetryLink or manual retry) so transient failures don’t leave gaps.  
   - Never assume all 6 succeeded; always handle partial success.

5. **Optional: “Stay loaded after refresh”**  
   - Persist cache (Apollo persist plugin) **or**  
   - Custom layer: on load, read from localStorage (or similar); if valid, set state and render; then fetch and update. So first paint is fast and data “stays loaded” until new data replaces it.

6. **When to refetch**  
   - Refetch only when: user explicitly refreshes, or you open a “refresh” action, or you use a stale-while-revalidate policy that does a background refetch. Default should be: **no refetch on every revisit** so coming back is instant.

---

## 6. Prompt to Give to Another Cursor / Developer

Copy the block below into the other project so they implement the same behavior.

```text
We need the same caching and navigation behavior as our main site:

1) Page switching and coming back
- Use a single Apollo Client (or React Query client) for the whole app, provided at the root.
- Set default fetch policy to cache-first so when the user navigates away and comes back, data is read from cache and not refetched. Data should "stay loaded".
- Only refetch on full page refresh or when we explicitly call refetch(). Do not refetch on every revisit.

2) Fast load and “stay loaded”
- First visit: run the query, store result in cache, render.
- Revisit (navigate back): read from cache only, no network request, instant render.
- Optional: persist cache (e.g. apollo3-cache-persist with localStorage) or a custom localStorage cache so that even after a full refresh we show cached data first, then update when the network request completes.

3) Multiple queries (e.g. 6) running together
- Do NOT use Promise.all (one failure would reject everything). Use Promise.allSettled so each query succeeds or fails independently.
- After allSettled: for fulfilled results use the data; for rejected results use [] or a safe default. Never assume all 6 succeeded.
- Add retries (e.g. Apollo RetryLink with 3 attempts and jittered delay, or a small retry loop for fetch) so transient failures don’t leave some queries permanently failed.
- Ensure the UI always shows whatever data did load; failed categories show empty list or a small error message, not a full-page error.

4) Summary
- One client, cache-first, client-side navigation = data stays loaded when coming back.
- allSettled + per-query fallbacks + retries = all 6 queries are used where they succeed and don’t fail each other.
- Optionally persist cache so after refresh we still show cached data and then load fresh data.
```

---

## 7. How Queries Don’t “Fail” Each Other

- **Promise.allSettled**: no query can “fail” the whole batch. You get an array of `{ status, value? }` or `{ status, reason? }`.  
- **Merge step**: `data = status === 'fulfilled' ? value.data : default`.  
- **Retries**: increase the chance that each query eventually succeeds.  
- **UI**: render using merged data; show empty or error only for the failed slice, not the whole page.

That’s how “all queries load” in practice: each one is independent, failures are isolated, and the page always has something to show.
