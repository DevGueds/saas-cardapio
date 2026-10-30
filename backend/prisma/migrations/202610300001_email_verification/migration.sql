-- Existing accounts receive a fresh grace period; no email ownership is assumed.
ALTER TABLE "User"
  ADD COLUMN "emailVerifiedAt" TIMESTAMPTZ(3),
  ADD COLUMN "emailVerificationDeadline" TIMESTAMPTZ(3) NOT NULL DEFAULT (now() + interval '7 days');

CREATE TABLE "EmailVerificationChallenge" (
  "userId" UUID PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
  "codeHash" CHAR(64) NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "retryAt" TIMESTAMPTZ(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0 CHECK ("attempts" BETWEEN 0 AND 5)
);
CREATE INDEX "EmailVerificationChallenge_expiresAt_idx" ON "EmailVerificationChallenge"("expiresAt");
