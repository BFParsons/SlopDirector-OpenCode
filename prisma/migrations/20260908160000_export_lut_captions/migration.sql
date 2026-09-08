-- Export format, custom LUT, libass caption style.
ALTER TYPE "AssetKind" ADD VALUE 'LUT';
ALTER TABLE "Project" ADD COLUMN "exportCodec" TEXT NOT NULL DEFAULT 'h264',
                      ADD COLUMN "captionStyle" TEXT NOT NULL DEFAULT 'OUTLINE',
                      ADD COLUMN "lutAssetId" TEXT;
ALTER TABLE "Project" ADD CONSTRAINT "Project_lutAssetId_fkey" FOREIGN KEY ("lutAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
