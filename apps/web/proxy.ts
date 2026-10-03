import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export default process.env.LOCAL_MODE === "true"
  ? function localProxy() {
      return NextResponse.next();
    }
  : clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
