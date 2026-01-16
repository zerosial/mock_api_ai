-- CreateEnum
CREATE TYPE "public"."ProxyVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "public"."ProxyMemberRole" AS ENUM ('OWNER', 'EDITOR');

-- CreateEnum
CREATE TYPE "public"."ProxyInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

-- AlterTable
ALTER TABLE "public"."proxy_servers" ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "visibility" "public"."ProxyVisibility" NOT NULL DEFAULT 'PRIVATE';

-- CreateTable
CREATE TABLE "public"."proxy_server_members" (
    "id" SERIAL NOT NULL,
    "proxyServerId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "public"."ProxyMemberRole" NOT NULL DEFAULT 'EDITOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proxy_server_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."proxy_server_invites" (
    "id" SERIAL NOT NULL,
    "proxyServerId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "status" "public"."ProxyInviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proxy_server_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "proxy_server_members_proxyServerId_userId_key" ON "public"."proxy_server_members"("proxyServerId", "userId");

-- CreateIndex
CREATE INDEX "proxy_server_invites_proxyServerId_email_status_idx" ON "public"."proxy_server_invites"("proxyServerId", "email", "status");

-- Ensure a legacy owner exists if there are no users
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
INSERT INTO "public"."users" ("id", "email", "name", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'legacy-owner@local', 'Legacy Owner', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "public"."users");

-- Backfill ownerId for existing proxy servers
WITH owner_user AS (
  SELECT "id" FROM "public"."users" ORDER BY "createdAt" ASC LIMIT 1
)
UPDATE "public"."proxy_servers"
SET "ownerId" = (SELECT "id" FROM owner_user)
WHERE "ownerId" IS NULL;

-- Backfill owner membership for existing proxy servers
INSERT INTO "public"."proxy_server_members" ("proxyServerId", "userId", "role", "createdAt")
SELECT "id", "ownerId", 'OWNER', NOW()
FROM "public"."proxy_servers"
WHERE "ownerId" IS NOT NULL
ON CONFLICT ("proxyServerId", "userId") DO NOTHING;

-- Enforce ownerId NOT NULL after backfill
ALTER TABLE "public"."proxy_servers" ALTER COLUMN "ownerId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."proxy_servers" ADD CONSTRAINT "proxy_servers_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proxy_server_members" ADD CONSTRAINT "proxy_server_members_proxyServerId_fkey" FOREIGN KEY ("proxyServerId") REFERENCES "public"."proxy_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proxy_server_members" ADD CONSTRAINT "proxy_server_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proxy_server_invites" ADD CONSTRAINT "proxy_server_invites_proxyServerId_fkey" FOREIGN KEY ("proxyServerId") REFERENCES "public"."proxy_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proxy_server_invites" ADD CONSTRAINT "proxy_server_invites_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

