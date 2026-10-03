import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { scriptBreakdownFunction } from "@/inngest/functions/script-breakdown";
import { imageGenerationFunction } from "@/inngest/functions/image-generation";
import { exportProjectFunction } from "@/inngest/functions/export-project";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    scriptBreakdownFunction,
    imageGenerationFunction,
    exportProjectFunction,
  ],
});
