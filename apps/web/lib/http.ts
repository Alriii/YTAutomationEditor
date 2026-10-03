import { ZodError } from "zod";

export function errorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return Response.json({ error: "Validation failed.", issues: error.issues }, { status: 400 });
  }
  if (error instanceof Error) {
    if (error.message === "UNAUTHENTICATED") return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error.message === "NOT_FOUND") return Response.json({ error: "Not found." }, { status: 404 });
    if (error.message === "FORBIDDEN") return Response.json({ error: "Forbidden." }, { status: 403 });
  }
  console.error(error);
  return Response.json({ error: "Internal server error." }, { status: 500 });
}
