import "server-only";

import { requireAdmin } from "@/server/authz/guards";
import { getAppointmentsForAdminOversight } from "@/server/dal/admin";
import { Container } from "@/components/layout/container";
import { AppointmentOversightTable } from "@/features/admin/appointment-oversight-table";
import { appointmentFilterSchema } from "@/schemas/admin";
import { Search } from "lucide-react";

export const metadata = {
  title: "Appointment Oversight — Admin",
  description: "Monitor booking status and perform administrative interventions.",
};

interface PageProps {
  searchParams: Promise<{
    status?: string;
    search?: string;
    page?: string;
  }>;
}

export default async function AdminAppointmentsPage({ searchParams }: PageProps) {
  await requireAdmin();

  const params = await searchParams;
  const parsed = appointmentFilterSchema.safeParse(params);
  const filter = parsed.success
    ? parsed.data
    : { status: "ALL" as const, search: "", page: 1, perPage: 20 };

  const { appointments, total } = await getAppointmentsForAdminOversight(filter);

  return (
    <Container className="py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Appointment Oversight
          </h1>
          <p className="text-sm text-muted-foreground">
            {total} appointment{total === 1 ? "" : "s"} across the platform (metadata-only projection, zero clinical note exposure)
          </p>
        </div>

        <form className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              name="search"
              defaultValue={filter.search}
              placeholder="Search client or consultant..."
              className="pl-9 pr-3 py-1.5 text-sm border rounded-md w-48 sm:w-64"
            />
          </div>

          <select
            name="status"
            defaultValue={filter.status}
            className="text-sm border rounded-md py-1.5 px-2 bg-background"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="NO_SHOW">No Show</option>
          </select>

          <button
            type="submit"
            className="text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90"
          >
            Filter
          </button>
        </form>
      </div>

      <AppointmentOversightTable appointments={appointments} />
    </Container>
  );
}
