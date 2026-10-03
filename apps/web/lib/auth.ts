import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@continuity/db";

export function isLocalMode(): boolean {
  return process.env.LOCAL_MODE === "true";
}

async function localUser() {
  return db.user.upsert({
    where: { clerkUserId: "local-user" },
    update: {},
    create: {
      clerkUserId: "local-user",
      email: "local@continuity.local",
      displayName: "Local Creator",
    },
  });
}

export async function requireAppUser() {
  if (isLocalMode()) {
    return localUser();
  }

  const session = await auth();
  if (!session.userId) throw new Error("UNAUTHENTICATED");

  const existing = await db.user.findUnique({
    where: { clerkUserId: session.userId },
  });
  if (existing) return existing;

  const clerkUser = await currentUser();
  const email =
    clerkUser?.primaryEmailAddress?.emailAddress ??
    clerkUser?.emailAddresses[0]?.emailAddress ??
    `${session.userId}@pending.local`;

  return db.user.create({
    data: {
      clerkUserId: session.userId,
      email,
      displayName:
        clerkUser?.fullName ??
        clerkUser?.username ??
        clerkUser?.firstName ??
        null,
    },
  });
}

export async function requireOwnedProject(projectId: string) {
  const user = await requireAppUser();
  const project = await db.project.findFirst({
    where: {
      id: projectId,
      ownerId: user.id,
      deletedAt: null,
    },
  });

  if (!project) throw new Error("NOT_FOUND");
  return { user, project };
}
