-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "imageModel" TEXT NOT NULL DEFAULT 'fal-ai/flux/dev';

-- AlterTable
ALTER TABLE "StoryElement" ADD COLUMN     "costCents" INTEGER NOT NULL DEFAULT 0;
