import { Metadata } from "next";
import { searchConsultants } from "@/server/dal/consultant-search";
import { getActiveSpecializations, getActiveLanguages } from "@/server/dal/taxonomy";
import { ConsultantsClient } from "@/features/consultants/consultant-grid";
import { consultantSearchSchema } from "@/schemas/consultant-search";

export const metadata: Metadata = {
  title: "Find a Consultant",
  description: "Search for qualified psychological consultants by specialization, language, price, and availability.",
};

interface ConsultantsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ConsultantsPage({ searchParams }: ConsultantsPageProps) {
  const params = await searchParams;
  const parsed = consultantSearchSchema.safeParse(params);

  const input = parsed.success ? parsed.data : consultantSearchSchema.parse({});
  const { consultants, total } = await searchConsultants(input);

  const [activeSpecs, activeLangs] = await Promise.all([
    getActiveSpecializations(),
    getActiveLanguages(),
  ]);

  return (
    <ConsultantsClient
      initialInput={input}
      initialConsultants={consultants}
      initialTotal={total}
      activeSpecs={activeSpecs.map((s) => ({ id: s.id, name: s.name }))}
      activeLangs={activeLangs.map((l) => ({ id: l.id, name: l.name }))}
    />
  );
}