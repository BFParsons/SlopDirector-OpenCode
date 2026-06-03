-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "defaultProjectFolder" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "quotaAdsMonth" INTEGER NOT NULL DEFAULT 20,
    "openrouterKeyEnc" TEXT,
    "openrouterKeyHint" TEXT,
    "falKeyEnc" TEXT,
    "falKeyHint" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WorkspaceLayout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Workspace',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "section" TEXT NOT NULL DEFAULT 'video',
    "layout" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkspaceLayout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bundlePath" TEXT,
    "audioSession" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "goal" TEXT,
    "subject" TEXT,
    "tone" TEXT,
    "targetLengthS" INTEGER NOT NULL DEFAULT 30,
    "aspectRatio" TEXT NOT NULL DEFAULT 'R16_9',
    "resolution" TEXT NOT NULL DEFAULT 'R720P',
    "audioFitMode" TEXT NOT NULL DEFAULT 'PAD_VIDEO',
    "shotCount" INTEGER NOT NULL DEFAULT 5,
    "stylePrompt" TEXT,
    "styleAnchorAssetId" TEXT,
    "styleStrength" REAL NOT NULL DEFAULT 0.85,
    "audioNormalize" BOOLEAN NOT NULL DEFAULT true,
    "colorLook" TEXT NOT NULL DEFAULT 'NONE',
    "transition" TEXT NOT NULL DEFAULT 'NONE',
    "transitionMs" INTEGER NOT NULL DEFAULT 500,
    "fillMode" TEXT NOT NULL DEFAULT 'LETTERBOX',
    "vignette" BOOLEAN NOT NULL DEFAULT false,
    "grain" INTEGER NOT NULL DEFAULT 0,
    "audioFadeInS" REAL NOT NULL DEFAULT 0,
    "audioFadeOutS" REAL NOT NULL DEFAULT 0,
    "captionsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "captionPosition" TEXT NOT NULL DEFAULT 'BOTTOM_CENTER',
    "captionSizePct" INTEGER NOT NULL DEFAULT 6,
    "watermarkAssetId" TEXT,
    "watermarkPosition" TEXT NOT NULL DEFAULT 'BOTTOM_RIGHT',
    "watermarkScale" REAL NOT NULL DEFAULT 0.15,
    "watermarkOpacity" REAL NOT NULL DEFAULT 0.85,
    "watermarkMargin" INTEGER NOT NULL DEFAULT 24,
    "audioMode" TEXT NOT NULL DEFAULT 'TTS_FROM_SCRIPT',
    "voScript" TEXT,
    "voVerbatim" TEXT,
    "voDeliveryNotes" TEXT,
    "musicAssetId" TEXT,
    "musicVolume" REAL NOT NULL DEFAULT 0.25,
    "musicDucking" BOOLEAN NOT NULL DEFAULT true,
    "musicMuted" BOOLEAN NOT NULL DEFAULT false,
    "voVolume" REAL NOT NULL DEFAULT 1,
    "voMuted" BOOLEAN NOT NULL DEFAULT false,
    "llmModel" TEXT NOT NULL,
    "videoModel" TEXT NOT NULL,
    "ttsModel" TEXT NOT NULL,
    "ttsVoice" TEXT,
    "imageModel" TEXT NOT NULL DEFAULT 'fal-ai/flux/dev',
    "generateAudio" BOOLEAN NOT NULL DEFAULT false,
    "concept" TEXT,
    "scriptFull" TEXT,
    "visualGenStatus" TEXT,
    "scriptGenStatus" TEXT,
    "estCostCents" INTEGER,
    "error" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Project_styleAnchorAssetId_fkey" FOREIGN KEY ("styleAnchorAssetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Project_watermarkAssetId_fkey" FOREIGN KEY ("watermarkAssetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Project_musicAssetId_fkey" FOREIGN KEY ("musicAssetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Segment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "title" TEXT,
    "source" TEXT NOT NULL DEFAULT 'AI_GENERATED',
    "prompt" TEXT NOT NULL DEFAULT '',
    "videoModel" TEXT,
    "speed" REAL NOT NULL DEFAULT 1.0,
    "durationS" REAL NOT NULL DEFAULT 5,
    "sourceDurationS" REAL,
    "trimStartS" REAL NOT NULL DEFAULT 0,
    "imageMotion" TEXT NOT NULL DEFAULT 'NONE',
    "muted" BOOLEAN NOT NULL DEFAULT true,
    "brightness" REAL NOT NULL DEFAULT 0,
    "contrast" REAL NOT NULL DEFAULT 1,
    "saturation" REAL NOT NULL DEFAULT 1,
    "transform" JSONB,
    "track" INTEGER NOT NULL DEFAULT 0,
    "audioOnly" BOOLEAN NOT NULL DEFAULT false,
    "library" BOOLEAN NOT NULL DEFAULT false,
    "offsetS" REAL NOT NULL DEFAULT 0,
    "pip" JSONB,
    "effects" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "importUrl" TEXT,
    "importStartS" INTEGER,
    "importEndS" INTEGER,
    "sourceAssetId" TEXT,
    "refImageId" TEXT,
    "refRole" TEXT,
    "providerJobId" TEXT,
    "clipAssetId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Segment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Segment_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Segment_refImageId_fkey" FOREIGN KEY ("refImageId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Segment_clipAssetId_fkey" FOREIGN KEY ("clipAssetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SegmentElementRef" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "segmentId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "variantId" TEXT,
    "index" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SegmentElementRef_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SegmentElementRef_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "StoryElement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VoiceoverAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "assetId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'SYNTHESIZED',
    "durationS" REAL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VoiceoverAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VoiceoverAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AudioOverlay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "label" TEXT,
    "assetId" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "importStartS" INTEGER NOT NULL,
    "importEndS" INTEGER NOT NULL,
    "offsetS" REAL NOT NULL DEFAULT 0,
    "volume" REAL NOT NULL DEFAULT 1.0,
    "included" BOOLEAN NOT NULL DEFAULT true,
    "durationS" REAL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AudioOverlay_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AudioOverlay_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FinalRender" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "assetId" TEXT,
    "durationS" REAL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FinalRender_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FinalRender_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Asset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TextOverlay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "position" TEXT NOT NULL DEFAULT 'BOTTOM_CENTER',
    "sizePct" INTEGER NOT NULL DEFAULT 6,
    "color" TEXT NOT NULL DEFAULT '#FFFFFF',
    "boxEnabled" BOOLEAN NOT NULL DEFAULT true,
    "boxColor" TEXT NOT NULL DEFAULT '#000000',
    "boxOpacity" REAL NOT NULL DEFAULT 0.5,
    "marginPx" INTEGER NOT NULL DEFAULT 40,
    "startS" REAL NOT NULL DEFAULT 0,
    "endS" REAL,
    "animation" TEXT NOT NULL DEFAULT 'NONE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TextOverlay_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StoryElement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prompt" TEXT NOT NULL DEFAULT '',
    "assetId" TEXT,
    "refImageIds" TEXT NOT NULL DEFAULT '[]',
    "error" TEXT,
    "costCents" REAL NOT NULL DEFAULT 0,
    "index" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StoryElement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StoryElement_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StoryElementVariant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "elementId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "prompt" TEXT NOT NULL DEFAULT '',
    "assetId" TEXT,
    "error" TEXT,
    "index" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StoryElementVariant_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "StoryElement" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StoryElementVariant_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "availableAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" DATETIME,
    "lockedBy" TEXT,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Job_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "WorkspaceLayout_userId_idx" ON "WorkspaceLayout"("userId");

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
CREATE INDEX "SegmentElementRef_segmentId_idx" ON "SegmentElementRef"("segmentId");

-- CreateIndex
CREATE INDEX "SegmentElementRef_elementId_idx" ON "SegmentElementRef"("elementId");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceoverAsset_projectId_key" ON "VoiceoverAsset"("projectId");

-- CreateIndex
CREATE INDEX "AudioOverlay_projectId_idx" ON "AudioOverlay"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "FinalRender_projectId_key" ON "FinalRender"("projectId");

-- CreateIndex
CREATE INDEX "Asset_projectId_kind_idx" ON "Asset"("projectId", "kind");

-- CreateIndex
CREATE INDEX "TextOverlay_projectId_idx" ON "TextOverlay"("projectId");

-- CreateIndex
CREATE INDEX "StoryElement_projectId_kind_idx" ON "StoryElement"("projectId", "kind");

-- CreateIndex
CREATE INDEX "StoryElementVariant_elementId_idx" ON "StoryElementVariant"("elementId");

-- CreateIndex
CREATE INDEX "Job_status_availableAt_idx" ON "Job"("status", "availableAt");

-- CreateIndex
CREATE INDEX "Job_type_status_idx" ON "Job"("type", "status");

