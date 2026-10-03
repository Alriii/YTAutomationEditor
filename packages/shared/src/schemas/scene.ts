import { z } from "zod";

export const sceneBreakdownItemSchema = z.object({
  sceneNumber: z.number().int().positive(),
  title: z.string().trim().max(140).optional(),
  narration: z.string().trim().min(1),
  visualIntent: z.string().trim().min(1),
  action: z.string().trim().optional(),
  shotType: z.string().trim().optional(),
  camera: z.string().trim().optional(),
  lighting: z.string().trim().optional(),
  durationHintMs: z.number().int().min(500).max(60000).optional(),
  characterIds: z.array(z.string().uuid()).default([]),
  locationId: z.string().uuid().nullable().optional(),
  continuityNotes: z.array(z.string().trim()).default([]),
});

export const sceneBreakdownSchema = z.object({
  scenes: z.array(sceneBreakdownItemSchema).min(1).max(200),
});

export const updateSceneSchema = sceneBreakdownItemSchema
  .omit({ sceneNumber: true })
  .partial();

export type SceneBreakdownItem = z.infer<typeof sceneBreakdownItemSchema>;
