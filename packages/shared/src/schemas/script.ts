import { z } from "zod";

export const saveScriptSchema = z.object({
  title: z.string().trim().min(1).max(200).default("Primary script"),
  content: z.string().trim().min(20).max(500000),
  targetDurationSec: z.number().int().min(30).max(14400).optional(),
  locked: z.boolean().default(false),
});
