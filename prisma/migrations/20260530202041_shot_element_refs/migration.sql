-- CreateTable
CREATE TABLE "SegmentElementRef" (
    "id" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "variantId" TEXT,
    "index" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SegmentElementRef_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SegmentElementRef_segmentId_idx" ON "SegmentElementRef"("segmentId");

-- CreateIndex
CREATE INDEX "SegmentElementRef_elementId_idx" ON "SegmentElementRef"("elementId");

-- AddForeignKey
ALTER TABLE "SegmentElementRef" ADD CONSTRAINT "SegmentElementRef_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SegmentElementRef" ADD CONSTRAINT "SegmentElementRef_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "StoryElement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
