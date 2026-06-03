-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "captionPosition" "OverlayPosition" NOT NULL DEFAULT 'BOTTOM_CENTER',
ADD COLUMN     "captionSizePct" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN     "captionsEnabled" BOOLEAN NOT NULL DEFAULT false;
