-- AlterEnum
ALTER TYPE "JobType" ADD VALUE 'IMPORT_YOUTUBE';

-- AlterTable
ALTER TABLE "Segment" ADD COLUMN     "importEndS" INTEGER,
ADD COLUMN     "importStartS" INTEGER,
ADD COLUMN     "importUrl" TEXT;
