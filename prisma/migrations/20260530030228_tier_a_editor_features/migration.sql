-- CreateEnum
CREATE TYPE "FillMode" AS ENUM ('LETTERBOX', 'BLUR_FILL');

-- CreateEnum
CREATE TYPE "OverlayPosition" AS ENUM ('TOP_LEFT', 'TOP_CENTER', 'TOP_RIGHT', 'MIDDLE_LEFT', 'CENTER', 'MIDDLE_RIGHT', 'BOTTOM_LEFT', 'BOTTOM_CENTER', 'BOTTOM_RIGHT');

-- CreateEnum
CREATE TYPE "TextAnimation" AS ENUM ('NONE', 'FADE');

-- AlterEnum
ALTER TYPE "AssetKind" ADD VALUE 'WATERMARK';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ColorLook" ADD VALUE 'TEAL_ORANGE';
ALTER TYPE "ColorLook" ADD VALUE 'NOIR';
ALTER TYPE "ColorLook" ADD VALUE 'CAMPAIGN';
ALTER TYPE "ColorLook" ADD VALUE 'BLEACH';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "audioFadeInS" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "audioFadeOutS" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "fillMode" "FillMode" NOT NULL DEFAULT 'LETTERBOX',
ADD COLUMN     "grain" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "vignette" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "watermarkAssetId" TEXT,
ADD COLUMN     "watermarkMargin" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "watermarkOpacity" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
ADD COLUMN     "watermarkPosition" "OverlayPosition" NOT NULL DEFAULT 'BOTTOM_RIGHT',
ADD COLUMN     "watermarkScale" DOUBLE PRECISION NOT NULL DEFAULT 0.15;

-- AlterTable
ALTER TABLE "Segment" ADD COLUMN     "brightness" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "contrast" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN     "saturation" DOUBLE PRECISION NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "TextOverlay" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "position" "OverlayPosition" NOT NULL DEFAULT 'BOTTOM_CENTER',
    "sizePct" INTEGER NOT NULL DEFAULT 6,
    "color" TEXT NOT NULL DEFAULT '#FFFFFF',
    "boxEnabled" BOOLEAN NOT NULL DEFAULT true,
    "boxColor" TEXT NOT NULL DEFAULT '#000000',
    "boxOpacity" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "marginPx" INTEGER NOT NULL DEFAULT 40,
    "startS" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "endS" DOUBLE PRECISION,
    "animation" "TextAnimation" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TextOverlay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TextOverlay_projectId_idx" ON "TextOverlay"("projectId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_watermarkAssetId_fkey" FOREIGN KEY ("watermarkAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TextOverlay" ADD CONSTRAINT "TextOverlay_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
