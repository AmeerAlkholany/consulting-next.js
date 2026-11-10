import "server-only";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/dal";
import { getNotifications } from "@/server/dal/notification";
import { Container } from "@/components/layout/container";
import { NotificationList } from "@/features/notifications/notification-list";
import { notificationFilterSchema } from "@/schemas/notification";

export const metadata = {
  title: "Notifications",
  description: "Stay informed about your consultations, requests, and platform updates.",
};

interface PageProps {
  searchParams: Promise<{ page?: string; perPage?: string }>;
}

export default async function NotificationsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const parsed = notificationFilterSchema.safeParse(params);
  const filter = parsed.success ? parsed.data : { page: 1, perPage: 25 };

  const { notifications, unreadCount } = await getNotifications(user.id, filter);

  return (
    <Container className="py-8 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          Platform and appointment alerts for your account.
        </p>
      </div>

      <NotificationList
        initialNotifications={notifications}
        unreadCount={unreadCount}
      />
    </Container>
  );
}
