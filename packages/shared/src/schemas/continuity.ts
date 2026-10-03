import { z } from "zod";

const optionalText = z.string().trim().max(5000).optional();

export const styleBibleSchema = z.object({
  name: z.string().trim().min(1).max(120).default("Primary style"),
  visualStyle: z.string().trim().min(1).max(8000),
  mediumRules: optionalText,
  cameraRules: optionalText,
  lightingRules: optionalText,
  colorRules: optionalText,
  compositionRules: optionalText,
  historicalRules: optionalText,
  wardrobeRules: optionalText,
  technologyRules: optionalText,
  negativeConstraints: z.array(z.string().trim().min(1).max(500)).max(100).default([]),
  promptPrefix: optionalText,
  promptSuffix: optionalText,
  locked: z.boolean().default(false),
});

export const characterSchema = z.object({
  name: z.string().trim().min(1).max(120),
  role: z.string().trim().max(120).optional(),
  description: z.string().trim().min(1).max(8000),
  physicalTraits: optionalText,
  ageDescription: z.string().trim().max(500).optional(),
  hairRules: optionalText,
  wardrobeRules: optionalText,
  accessoryRules: optionalText,
  expressionRules: optionalText,
  prohibitedChanges: z.array(z.string().trim().min(1).max(500)).max(100).default([]),
  locked: z.boolean().default(false),
});

export const locationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(8000),
  era: z.string().trim().max(250).optional(),
  architectureRules: optionalText,
  technologyRules: optionalText,
  lightingRules: optionalText,
  environmentalRules: optionalText,
  prohibitedElements: z.array(z.string().trim().min(1).max(500)).max(100).default([]),
  locked: z.boolean().default(false),
});
