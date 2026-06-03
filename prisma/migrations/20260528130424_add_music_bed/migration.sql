-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "musicAssetId" TEXT,
ADD COLUMN     "musicDucking" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "musicVolume" DOUBLE PRECISION NOT NULL DEFAULT 0.25;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_musicAssetId_fkey" FOREIGN KEY ("musicAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
