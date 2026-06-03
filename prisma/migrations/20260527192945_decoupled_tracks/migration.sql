-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "AdStatus" AS ENUM ('DRAFT', 'RENDERING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "AspectRatio" AS ENUM ('R16_9', 'R9_16', 'R1_1');

-- CreateEnum
CREATE TYPE "Resolution" AS ENUM ('R480P', 'R720P', 'R1080P');

-- CreateEnum
CREATE TYPE "AudioFitMode" AS ENUM ('PAD_VIDEO', 'TRIM_VO');

-- CreateEnum
CREATE TYPE "AudioMode" AS ENUM ('TTS_FROM_SCRIPT', 'TTS_VERBATIM', 'UPLOAD_AUDIO', 'NONE');

-- CreateEnum
CREATE TYPE "ShotStatus" AS ENUM ('PENDING', 'SUBMITTED', 'RENDERING', 'DOWNLOADING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "RefRole" AS ENUM ('FIRST_FRAME', 'LAST_FRAME', 'STYLE');

-- CreateEnum
CREATE TYPE "SegmentSource" AS ENUM ('AI_GENERATED', 'UPLOAD_VIDEO', 'UPLOAD_IMAGE_STILL', 'UPLOAD_IMAGE_DRIVER');

-- CreateEnum
CREATE TYPE "SimpleStatus" AS ENUM ('PENDING', 'RUNNING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "AudioAssetSource" AS ENUM ('SYNTHESIZED', 'UPLOADED');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('UPLOAD_IMAGE', 'UPLOAD_VIDEO', 'UPLOAD_AUDIO', 'SHOT_CLIP', 'VO_AUDIO', 'FINAL_MP4');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('GEN_STORYBOARD', 'GEN_SCRIPT', 'SUBMIT_SHOT', 'RECONCILE_VIDEO', 'DOWNLOAD_CLIP', 'SYNTH_VO', 'ASSEMBLE_FINAL', 'CLEANUP');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "quotaAdsMonth" INTEGER NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "AdStatus" NOT NULL DEFAULT 'DRAFT',
    "goal" TEXT,
    "subject" TEXT,
    "tone" TEXT,
    "targetLengthS" INTEGER NOT NULL DEFAULT 30,
    "aspectRatio" "AspectRatio" NOT NULL DEFAULT 'R16_9',
    "resolution" "Resolution" NOT NULL DEFAULT 'R720P',
    "audioFitMode" "AudioFitMode" NOT NULL DEFAULT 'PAD_VIDEO',
    "shotCount" INTEGER NOT NULL DEFAULT 5,
    "audioMode" "AudioMode" NOT NULL DEFAULT 'TTS_FROM_SCRIPT',
    "voScript" TEXT,
    "voVerbatim" TEXT,
    "voDeliveryNotes" TEXT,
    "llmModel" TEXT NOT NULL,
    "videoModel" TEXT NOT NULL,
    "ttsModel" TEXT NOT NULL,
    "ttsVoice" TEXT,
    "generateAudio" BOOLEAN NOT NULL DEFAULT false,
    "concept" TEXT,
    "scriptFull" TEXT,
    "visualGenStatus" "SimpleStatus",
    "scriptGenStatus" "SimpleStatus",
    "estCostCents" INTEGER,
    "error" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Segment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "title" TEXT,
    "source" "SegmentSource" NOT NULL DEFAULT 'AI_GENERATED',
    "prompt" TEXT NOT NULL DEFAULT '',
    "durationS" INTEGER NOT NULL DEFAULT 5,
    "kenBurns" BOOLEAN NOT NULL DEFAULT false,
    "status" "ShotStatus" NOT NULL DEFAULT 'PENDING',
    "sourceAssetId" TEXT,
    "refImageId" TEXT,
    "refRole" "RefRole",
    "providerJobId" TEXT,
    "clipAssetId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Segment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceoverAsset" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "assetId" TEXT,
    "source" "AudioAssetSource" NOT NULL DEFAULT 'SYNTHESIZED',
    "durationS" DOUBLE PRECISION,
    "status" "SimpleStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceoverAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalRender" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "assetId" TEXT,
    "durationS" DOUBLE PRECISION,
    "status" "SimpleStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinalRender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "AssetKind" NOT NULL,
    "path" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Project_userId_status_idx" ON "Project"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Segment_providerJobId_key" ON "Segment"("providerJobId");

-- CreateIndex
CREATE INDEX "Segment_providerJobId_idx" ON "Segment"("providerJobId");

-- CreateIndex
CREATE UNIQUE INDEX "Segment_projectId_index_key" ON "Segment"("projectId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceoverAsset_projectId_key" ON "VoiceoverAsset"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "FinalRender_projectId_key" ON "FinalRender"("projectId");

-- CreateIndex
CREATE INDEX "Asset_projectId_kind_idx" ON "Asset"("projectId", "kind");

-- CreateIndex
CREATE INDEX "Job_status_availableAt_idx" ON "Job"("status", "availableAt");

-- CreateIndex
CREATE INDEX "Job_type_status_idx" ON "Job"("type", "status");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Segment" ADD CONSTRAINT "Segment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Segment" ADD CONSTRAINT "Segment_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Segment" ADD CONSTRAINT "Segment_refImageId_fkey" FOREIGN KEY ("refImageId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Segment" ADD CONSTRAINT "Segment_clipAssetId_fkey" FOREIGN KEY ("clipAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceoverAsset" ADD CONSTRAINT "VoiceoverAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceoverAsset" ADD CONSTRAINT "VoiceoverAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalRender" ADD CONSTRAINT "FinalRender_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalRender" ADD CONSTRAINT "FinalRender_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
