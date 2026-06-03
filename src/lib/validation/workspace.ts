import { z } from "zod";
import { PANEL_TYPES } from "@/types/panel";

const positionSchema = z.object({
  x: z.number().min(-10_000).max(100_000),
  y: z.number().min(-10_000).max(100_000),
});

const sizeSchema = z.object({
  width: z.number().min(80).max(20_000),
  height: z.number().min(60).max(20_000),
});

const windowSchema = z.object({
  id: z.string().min(1).max(120),
  panelType: z.enum(PANEL_TYPES),
  title: z.string().max(200),
  position: positionSchema,
  size: sizeSchema,
  zIndex: z.number().int().min(0).max(1_000_000),
  isMinimized: z.boolean(),
  isMaximized: z.boolean(),
  preMaximizeState: z
    .object({ position: positionSchema, size: sizeSchema })
    .optional(),
});

export const workspaceLayoutDataSchema = z.object({
  version: z.literal(2),
  windows: z.array(windowSchema).max(40),
  nextZIndex: z.number().int().min(0).max(1_000_000),
});

export const putLayoutSchema = z
  .object({
    id: z.string().min(1).max(60).nullable().optional(),
    name: z.string().min(1).max(80).optional(),
    layout: workspaceLayoutDataSchema.optional(),
    isDefault: z.boolean().optional(),
    section: z.enum(["audio", "video"]).optional(),
  })
  .refine((b) => b.layout !== undefined || b.id !== undefined, {
    message: "either `layout` (create/update) or `id` (flag toggle) is required",
  });
export type PutLayoutInput = z.infer<typeof putLayoutSchema>;

export const deleteLayoutSchema = z.object({ id: z.string().min(1).max(60) });
