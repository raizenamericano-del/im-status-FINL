-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "authVersion" TEXT,
    CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminAccess" (
    "credentialVersion" TEXT NOT NULL,
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WaSession" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "state" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "desired" BOOLEAN NOT NULL DEFAULT false,
    "generation" INTEGER NOT NULL DEFAULT 0,
    "lastConnectedAt" DATETIME,
    "lastError" TEXT,
    "challengeCipher" TEXT,
    "challengeExpiresAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WaSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Secret" (
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "cipher" TEXT NOT NULL,

    PRIMARY KEY ("userId", "key"),
    CONSTRAINT "Secret_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Status" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "duration" INTEGER,
    "postedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "descriptorCipher" TEXT,
    "thumbnail" BLOB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Status_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "statusId" TEXT,
    "filename" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "duration" INTEGER,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleteRequestedAt" DATETIME,
    CONSTRAINT "Media_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Media_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "Status" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DownloadJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "statusId" TEXT,
    "state" TEXT NOT NULL DEFAULT 'WAITING',
    "contactName" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "finishedAt" DATETIME,
    CONSTRAINT "DownloadJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DownloadJob_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "Status" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Preference" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "retentionDays" INTEGER NOT NULL DEFAULT 7,
    "notifications" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Preference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Command" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "payloadCipher" TEXT,
    "state" TEXT NOT NULL DEFAULT 'WAITING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Command_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkerHealth" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "heartbeat" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storageReady" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "RateBucket" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "count" INTEGER NOT NULL,
    "expiresAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminAccess_userId_key" ON "AdminAccess"("userId");

-- CreateIndex
CREATE INDEX "Status_userId_postedAt_idx" ON "Status"("userId", "postedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Status_userId_fingerprint_key" ON "Status"("userId", "fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "Media_statusId_key" ON "Media"("statusId");

-- CreateIndex
CREATE INDEX "Media_userId_createdAt_idx" ON "Media"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DownloadJob_statusId_key" ON "DownloadJob"("statusId");

-- CreateIndex
CREATE INDEX "DownloadJob_state_createdAt_idx" ON "DownloadJob"("state", "createdAt");

-- CreateIndex
CREATE INDEX "DownloadJob_userId_createdAt_idx" ON "DownloadJob"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_userId_createdAt_idx" ON "Activity"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Command_state_createdAt_idx" ON "Command"("state", "createdAt");

-- CreateIndex
CREATE INDEX "RateBucket_expiresAt_idx" ON "RateBucket"("expiresAt");

