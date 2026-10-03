import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "Continuity Studio",
  description:
    "Continuity-first visual production for long-form documentary creators.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const localMode = process.env.LOCAL_MODE === "true";

  return (
    <html lang="en">
      <body>
        {localMode ? children : <ClerkProvider>{children}</ClerkProvider>}
      </body>
    </html>
  );
}
