# Phase 8-2-PLAN: HMAC Signing, Abuse Detection & IP Blocklist

Secure the B2B API surface and detect malicious usage patterns.

## 1. Goal
Require B2B API consumers to sign requests with HMAC-SHA256 using their assigned secret. Build an abuse scoring system that flags suspicious accounts and temporarily blocks abusive IPs.

## 2. Success Criteria
- [ ] B2B endpoints require `X-Signature` header containing HMAC-SHA256 of the request body.
- [ ] Signature verification middleware rejects unsigned or tampered requests with 401.
- [ ] Abuse score table tracks: failed verifications, upload frequency, and repeated hash collisions per user.
- [ ] Users exceeding abuse threshold are flagged for admin review.
- [ ] IPs with >5 consecutive auth failures are temporarily blocked for 15 minutes.

## 3. Tasks
1. **HMAC Middleware**: Create `server/middleware/hmac.js` — verifies `X-Signature` against the user's registered API secret using `crypto.timingSafeEqual`.
2. **API Secret Management**: Add `api_secret` column to users table; generate on B2B account creation; expose in admin dashboard.
3. **Abuse Scoring**: Create `server/utils/abuse.js` — increment counters in Redis for failed verifications, rapid uploads, and hash mismatches. Score = weighted sum.
4. **IP Blocklist**: Track consecutive auth failures per IP in Redis with TTL. Return 403 when threshold exceeded.
5. **Admin Alerts**: Add a "Security Alerts" section to the admin dashboard showing flagged accounts and blocked IPs.

## 4. Verification Plan
- **Signature Test**: Send a request with a wrong HMAC — confirm 401 rejection.
- **Abuse Test**: Simulate 20 rapid failed verifications — confirm account is flagged in admin view.
- **Blocklist Test**: Fail auth 6 times from same IP — confirm 403 on 7th attempt, then confirm unblock after 15 min TTL.
