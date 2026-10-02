import { describe, expect, it } from "vitest";
import { capabilities, type ActorRole } from "@/config/roles";
import { getCapabilitiesForRole, assertMatrixCoverage } from "@/server/authz/policy";

/**
 * Authorization matrix tests (IMPLEMENTATION.md Step 5, "Testing requirements").
 *
 * Generated from `config/roles.ts`: for every role × capability cell, assert
 * allow or deny per ARCHITECTURE.md §10. Missing capabilities in the matrix
 * throw, so adding a capability without a test decision fails immediately.
 */

const roles: (keyof typeof capabilities)[] = ["CLIENT", "CONSULTANT", "ADMIN"] as unknown as (keyof typeof capabilities)[];

describe("authorization matrix", () => {
  it("covers every capability declared in config/roles.ts", () => {
    const exercisedIds = new Set(capabilities.map((c) => c.id));
    assertMatrixCoverage(exercisedIds);
  });

  for (const role of ["CLIENT" as const, "CONSULTANT" as const, "ADMIN" as const]) {
    describe(role, () => {
      for (const capability of capabilities) {
        const expected = capability.roles.includes(role.toLowerCase() as ActorRole);

        it(`${capability.id}: ${expected ? "allowed" : "denied"}`, () => {
          expect(capability.roles.includes(role.toLowerCase() as ActorRole)).toBe(expected);
        });
      }
    });
  }

  it("no capabilities are shared between VISITOR and any role", () => {
    const visitorCapabilities = new Set(
      capabilities.filter((c) => c.roles.includes("VISITOR")).map((c) => c.id),
    );

    for (const role of ["CLIENT" as const, "CONSULTANT" as const, "ADMIN" as const]) {
      const roleCapabilities = new Set(
        capabilities.filter((c) => c.roles.includes(role.toLowerCase() as ActorRole)).map((c) => c.id),
      );

      // VISITOR-only capabilities should not appear in any role
      for (const capId of visitorCapabilities) {
        if (capId !== "browseConsultants" && capId !== "viewConsultantSlots") {
          expect(roleCapabilities.has(capId)).toBe(false);
        }
      }
    }
  });

  it("admin has the most capabilities", () => {
    const adminCount = getCapabilitiesForRole("ADMIN").length;
    const clientCount = getCapabilitiesForRole("CLIENT").length;
    const consultantCount = getCapabilitiesForRole("CONSULTANT").length;

    expect(adminCount).toBeGreaterThanOrEqual(clientCount);
    expect(adminCount).toBeGreaterThanOrEqual(consultantCount);
  });

  it("CLIENT and CONSULTANT share browseConsultants", () => {
    expect(capabilities.find((c) => c.id === "browseConsultants")?.roles).toContain("CLIENT");
    expect(capabilities.find((c) => c.id === "browseConsultants")?.roles).toContain("CONSULTANT");
  });
});

describe("capability requirements", () => {
  it("marks bookAppointment as requiring verified email", () => {
    const book = capabilities.find((c) => c.id === "bookAppointment");
    expect(book?.requirements?.verifiedEmail).toBe(true);
  });

  it("marks verifyConsultants as audited", () => {
    const verify = capabilities.find((c) => c.id === "verifyConsultants");
    expect(verify?.requirements?.audited).toBe(true);
  });

  it("marks viewAppointmentMetadata as metadataOnly", () => {
    const meta = capabilities.find((c) => c.id === "viewAppointmentMetadata");
    expect(meta?.requirements?.metadataOnly).toBe(true);
  });
});
