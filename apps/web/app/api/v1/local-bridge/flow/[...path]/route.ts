import { errorResponse } from "@/lib/http";
import { proxyLocalBridge } from "@/lib/local-bridge";

type Context = { params: Promise<{ path: string[] }> };

async function handle(request: Request, context: Context) {
  try {
    const { path } = await context.params;
    return await proxyLocalBridge(request, "flow", path);
  } catch (error) {
    return errorResponse(error);
  }
}

export const GET = handle;
export const POST = handle;
