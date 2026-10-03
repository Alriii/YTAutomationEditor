import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.LOCAL_MODE === "true") {
    return children;
  }

  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  return children;
}
