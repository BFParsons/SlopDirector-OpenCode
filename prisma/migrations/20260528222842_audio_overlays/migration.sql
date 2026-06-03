-- AlterEnum
ALTER TYPE "AssetKind" ADD VALUE 'OVERLAY_AUDIO';

-- AlterEnum
ALTER TYPE "JobType" ADD VALUE 'IMPORT_AUDIO';

-- CreateTable
CREATE TABLE "AudioOverlay" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "label" TEXT,
    "assetId" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "importStartS" INTEGER NOT NULL,
    "importEndS" INTEGER NOT NULL,
    "offsetS" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "volume" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "included" BOOLEAN NOT NULL DEFAULT true,
    "durationS" DOUBLE PRECISION,
    "status" "SimpleStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AudioOverlay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AudioOverlay_projectId_idx" ON "AudioOverlay"("projectId");

-- AddForeignKey
ALTER TABLE "AudioOverlay" ADD CONSTRAINT "AudioOverlay_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudioOverlay" ADD CONSTRAINT "AudioOverlay_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
