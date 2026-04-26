# Phase 8-1-PLAN: Rate Limiting & Anti-Replay

Defend all public endpoints against brute-force, replay, and volumetric abuse.

## 1. Goal
Implement per-IP and per-user rate limiting on every API endpoint, with stricter limits on upload and verify. Add nonce-based anti-replay protection to prevent signed payload reuse.

## 2. Success Criteria
- [ ] Global rate limit: 100 requests/15min per IP.
- [ ] Strict rate limit: 10 uploads/hour and 30 verifications/hour per authenticated user.
- [ ] Every POST request includes a `X-Nonce` header; server rejects duplicate nonces within a 5-minute TTL window.
- [ ] Rate limit violations return `429 Too Many Requests` with a `Retry-After` header.
- [ ] All rate limit hits are logged in the audit trail.

## 3. Tasks
1. **Install Dependencies**: Add `express-rate-limit` and `rate-limit-redis` (uses existing Redis from Bull).
2. **Global Limiter**: Apply a base rate limiter in `server/app.js` before all routes.
3. **Endpoint Limiters**: Create stricter limiters for `/api/upload` and `/api/verify/:id` in their respective route files.
4. **Nonce Middleware**: Create `server/middleware/nonce.js` — extracts `X-Nonce` from headers, checks Redis for duplicates, stores with 5-min TTL.
5. **Error Responses**: Ensure 429 responses include `Retry-After` and a human-readable error message.

## 4. Verification Plan
- **Load Test**: Use `autocannon` or `curl` loop to hit `/api/verify` 50 times rapidly — confirm 429 after threshold.
- **Replay Test**: Send the same `X-Nonce` twice — confirm second request is rejected with 409.
