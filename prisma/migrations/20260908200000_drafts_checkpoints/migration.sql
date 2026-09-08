-- Draft (low-res preview) renders + server-side edit checkpoints.
ALTER TYPE "AssetKind" ADD VALUE 'DRAFT_MP4';
ALTER TABLE "FinalRender" ADD COLUMN "draftAssetId" TEXT,
                          ADD COLUMN "draftUpdatedAt" TIMESTAMP(3);
CREATE TABLE "ProjectCheckpoint" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "label" TEXT,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectCheckpoint_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProjectCheckpoint_projectId_createdAt_idx" ON "ProjectCheckpoint"("projectId", "createdAt");
ALTER TABLE "ProjectCheckpoint" ADD CONSTRAINT "ProjectCheckpoint_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
