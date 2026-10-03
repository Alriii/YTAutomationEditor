import { AppShell } from "@/components/app-shell";
import { requireOwnedProject } from "@/lib/auth";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { project } = await requireOwnedProject(projectId);

  return (
    <AppShell
      projectId={projectId}
      projectTitle={project.title}
      localMode={process.env.LOCAL_MODE === "true"}
    >
      {children}
    </AppShell>
  );
}
