-- CreateEnum
CREATE TYPE "StoryElementKind" AS ENUM ('SCENE', 'CHARACTER', 'OBJECT');

-- CreateTable
CREATE TABLE "StoryElement" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "StoryElementKind" NOT NULL,
    "name" TEXT NOT NULL,
    "prompt" TEXT NOT NULL DEFAULT '',
    "assetId" TEXT,
    "error" TEXT,
    "index" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryElement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryElementVariant" (
    "id" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "prompt" TEXT NOT NULL DEFAULT '',
    "assetId" TEXT,
    "error" TEXT,
    "index" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryElementVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoryElement_projectId_kind_idx" ON "StoryElement"("projectId", "kind");

-- CreateIndex
CREATE INDEX "StoryElementVariant_elementId_idx" ON "StoryElementVariant"("elementId");

-- AddForeignKey
ALTER TABLE "StoryElement" ADD CONSTRAINT "StoryElement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryElement" ADD CONSTRAINT "StoryElement_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryElementVariant" ADD CONSTRAINT "StoryElementVariant_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "StoryElement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryElementVariant" ADD CONSTRAINT "StoryElementVariant_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
