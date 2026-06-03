-- CreateEnum
CREATE TYPE "ColorLook" AS ENUM ('NONE', 'WARM', 'COOL', 'BW', 'VINTAGE', 'PUNCH');

-- CreateEnum
CREATE TYPE "Transition" AS ENUM ('NONE', 'CROSSFADE', 'DISSOLVE', 'FADE_BLACK', 'WIPE', 'SLIDE');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "audioNormalize" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "colorLook" "ColorLook" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "transition" "Transition" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "transitionMs" INTEGER NOT NULL DEFAULT 500;

-- AlterTable
ALTER TABLE "Segment" ADD COLUMN     "speed" DOUBLE PRECISION NOT NULL DEFAULT 1.0;
