CREATE TYPE "PrivacyRequestKind" AS ENUM ('ACCESS', 'CORRECTION', 'DELETION', 'INFORMATION', 'OBJECTION', 'CONSENT');
CREATE TYPE "PrivacyRequestStatus" AS ENUM ('RECEIVED', 'IN_REVIEW', 'COMPLETED', 'DECLINED');

CREATE TABLE "LegalAcceptance" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "termsVersion" VARCHAR(40) NOT NULL,
  "privacyVersion" VARCHAR(40) NOT NULL,
  "acceptedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegalAcceptance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LegalAcceptance_userId_termsVersion_privacyVersion_key" ON "LegalAcceptance"("userId", "termsVersion", "privacyVersion");
CREATE INDEX "LegalAcceptance_userId_acceptedAt_idx" ON "LegalAcceptance"("userId", "acceptedAt");
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PrivacyRequest" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "kind" "PrivacyRequestKind" NOT NULL,
  "message" VARCHAR(1200) NOT NULL,
  "status" "PrivacyRequestStatus" NOT NULL DEFAULT 'RECEIVED',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMPTZ(3),
  "response" VARCHAR(2000),
  CONSTRAINT "PrivacyRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PrivacyRequest_userId_createdAt_idx" ON "PrivacyRequest"("userId", "createdAt");
CREATE INDEX "PrivacyRequest_status_createdAt_idx" ON "PrivacyRequest"("status", "createdAt");
ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
