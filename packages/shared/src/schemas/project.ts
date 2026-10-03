import { z } from "zod";

export const aspectRatioSchema = z.enum([
  "LANDSCAPE_16_9",
  "VERTICAL_9_16",
  "SQUARE_1_1",
]);

export const createProjectSchema = z.object({
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().max(2000).optional(),
  aspectRatio: aspectRatioSchema.default("LANDSCAPE_16_9"),
  language: z.string().trim().min(2).max(35).default("en"),
  targetDurationSec: z.number().int().min(30).max(14400).optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
