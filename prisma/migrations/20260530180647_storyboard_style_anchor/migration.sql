-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "styleAnchorAssetId" TEXT,
ADD COLUMN     "stylePrompt" TEXT,
ADD COLUMN     "styleStrength" DOUBLE PRECISION NOT NULL DEFAULT 0.85;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_styleAnchorAssetId_fkey" FOREIGN KEY ("styleAnchorAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
