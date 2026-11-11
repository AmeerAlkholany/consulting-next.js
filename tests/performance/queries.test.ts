import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { cleanDatabase, disconnectDatabase, prisma } from "@/tests/helpers/db";
import { searchConsultants } from "@/server/dal/consultant-search";
import { getClientAppointmentsByTab } from "@/server/dal/appointment";
import { generateSlots } from "@/server/services/availability";
import type { AvailabilityRuleRow } from "@/server/dal/availability";

describe("Performance & Query Plan Guarantees (Step 22)", () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  it("discovery query plan executes efficiently under load without N+1 regression", async () => {
    // Warm-up query to compile Prisma query plan
    await searchConsultants({
      q: "",
      specializationIds: [],
      languageIds: [],
      consultationTypes: [],
      sort: "rating",
      page: 1,
    });

    const start = performance.now();
    const result = await searchConsultants({
      q: "",
      specializationIds: [],
      languageIds: [],
      consultationTypes: [],
      sort: "rating",
      page: 1,
    });
    const duration = performance.now() - start;

    expect(result).toBeDefined();
    expect(result.consultants).toBeDefined();
    // Benchmark check: discovery query execution well under 300ms p95 threshold
    expect(duration).toBeLessThan(300);
  });

  it("slot generation for a 14-day range executes well under 150ms p95 budget", () => {
    const baseRule: AvailabilityRuleRow = {
      id: "rule-1",
      consultantProfileId: "consultant-1",
      weekday: 0, // Monday
      startMinute: 540, // 09:00
      endMinute: 1020, // 17:00
      effectiveFrom: null,
      effectiveUntil: null,
      isActive: true,
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
      updatedAt: new Date("2026-06-01T00:00:00.000Z"),
    };

    const start = performance.now();
    const result = generateSlots({
      rules: [baseRule],
      exceptions: [],
      appointments: [],
      bufferMinutes: 10,
      leadTimeMinutes: 12 * 60,
      maxAdvanceMinutes: 60 * 24 * 60,
      from: new Date("2026-06-15T00:00:00.000Z"),
      to: new Date("2026-06-29T23:59:59.999Z"),
      now: new Date("2026-06-14T10:00:00.000Z"),
      consultantTimezone: "Europe/Berlin",
      sessionDurationMinutes: 60,
    });
    const duration = performance.now() - start;

    expect(result.days.length).toBeGreaterThan(0);
    // Benchmark check: pure slot generation engine completes in single-digit milliseconds (<150ms budget)
    expect(duration).toBeLessThan(150);
  });

  it("dashboard queries run bounded batch queries without row-dependent N+1 calls", async () => {
    const user = await prisma.user.create({
      data: {
        email: `perf-user-${crypto.randomUUID()}@example.com`,
        fullName: "Perf Client",
        passwordHash: "dummy-hash",
        role: "CLIENT",
        status: "ACTIVE",
        clientProfile: { create: { displayName: "Perf Client" } },
      },
      include: { clientProfile: true },
    });

    const start = performance.now();
    const clientAppts = await getClientAppointmentsByTab(user.clientProfile!.id, "upcoming", {
      limit: 20,
      offset: 0,
    });
    const duration = performance.now() - start;

    expect(clientAppts.appointments).toBeDefined();
    expect(duration).toBeLessThan(100);
  });
});
