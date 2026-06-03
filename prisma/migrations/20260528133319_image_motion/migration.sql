-- CreateEnum
CREATE TYPE "ImageMotion" AS ENUM ('NONE', 'ZOOM_IN', 'ZOOM_OUT', 'PAN_LEFT', 'PAN_RIGHT', 'PAN_UP', 'PAN_DOWN');

-- AlterTable: add the motion column, preserve existing Ken Burns as ZOOM_IN, drop the boolean.
ALTER TABLE "Segment" ADD COLUMN "imageMotion" "ImageMotion" NOT NULL DEFAULT 'NONE';
UPDATE "Segment" SET "imageMotion" = 'ZOOM_IN' WHERE "kenBurns" = true;
ALTER TABLE "Segment" DROP COLUMN "kenBurns";
