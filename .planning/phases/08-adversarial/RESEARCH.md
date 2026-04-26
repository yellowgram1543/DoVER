# Phase 8 Research: Adversarial Hardening

**Phase:** 8
**Subsystem:** Security & API Protection
**Status:** PLANNED

## 1. Research Objectives
- Defend all API surfaces against brute-force, replay, and volumetric abuse.
- Implement cryptographic request authentication for B2B consumers.
- Build automated abuse detection and response mechanisms.

## 2. Technical Findings

### 2.1 Rate Limiting Strategy
- **Library**: `express-rate-limit` with `rate-limit-redis` store (leverages existing Redis).
- **Tiers**: Global (100/15min), Upload (10/hr), Verify (30/hr).
- **Key**: Use `req.user.id` for authenticated routes, `req.ip` for public routes.

### 2.2 Anti-Replay (Nonce)
- **Mechanism**: Client sends `X-Nonce` (UUID v4) with every request. Server stores in Redis with 5-min TTL.
- **Duplicate Detection**: `SETNX` in Redis — if key exists, nonce was already used → reject with 409.
- **Why Redis?**: Already deployed for Bull queue. TTL-based expiry is automatic.

### 2.3 HMAC Request Signing
- **Algorithm**: HMAC-SHA256 over `method + path + timestamp + body`.
- **Header**: `X-Signature: <hex-encoded HMAC>`, `X-Timestamp: <epoch>`.
- **Clock Skew**: Reject requests with timestamp > 5 minutes from server time.
- **Comparison**: `crypto.timingSafeEqual()` to prevent timing attacks.

### 2.4 Abuse Detection
- **Scoring Model**: Weighted sum of signals per user.
  - Failed verification: +2 points
  - Rapid uploads (>5/min): +3 points
  - Hash collision (uploading same hash): +1 point
  - Threshold: 15 points/hour → flag for review, 30 → auto-block.
- **Storage**: Redis sorted sets with hourly TTL.

## 3. Implementation Risks
- **False Positives**: Legitimate bulk uploaders (e.g., universities uploading 500 transcripts) could trigger abuse detection.
  - **Mitigation**: Whitelisted accounts with elevated limits.
- **Clock Skew**: HMAC timestamp validation can fail if client/server clocks diverge.
  - **Mitigation**: 5-minute window is generous enough for NTP-synced systems.

## 4. Confidence Assessment
- **Overall Confidence**: HIGH
- **Technical Path**: WELL-DEFINED
- **Research Gap**: None (all libraries are mature and battle-tested).
