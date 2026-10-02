import { NextResponse } from "next/server";
import { getActiveLanguages } from "@/server/dal/taxonomy";

export async function GET(): Promise<NextResponse> {
  const languages = await getActiveLanguages();
  return NextResponse.json(languages.map((l) => ({ id: l.id, name: l.name })));
}