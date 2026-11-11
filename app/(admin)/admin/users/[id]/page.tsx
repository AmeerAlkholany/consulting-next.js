import "server-only";

import { notFound } from "next/navigation";
import { requireAdmin } from "@/server/authz/guards";
import { getUserDetailForAdmin } from "@/server/dal/admin";
import { Container } from "@/components/layout/container";
import { UserDetail } from "@/features/admin/user-detail";

export const metadata = {
  title: "User Account Details — Admin",
  description: "View account activity, active sessions, and profile settings.",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminUserDetailPage({ params }: PageProps) {
  await requireAdmin();

  const { id } = await params;
  const user = await getUserDetailForAdmin(id);

  if (!user) {
    notFound();
  }

  return (
    <Container className="py-8">
      <UserDetail user={user} />
    </Container>
  );
}
