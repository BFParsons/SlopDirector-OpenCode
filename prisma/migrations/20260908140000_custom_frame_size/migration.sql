-- Custom frame size (px). Null = use the aspectRatio/resolution preset.
ALTER TABLE "Project" ADD COLUMN "frameWidth" INTEGER,
                      ADD COLUMN "frameHeight" INTEGER;
