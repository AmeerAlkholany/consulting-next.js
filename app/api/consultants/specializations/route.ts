import { NextResponse } from "next/server";
import { getActiveSpecializations } from "@/server/dal/taxonomy";

export async function GET(): Promise<NextResponse> {
  const specializations = await getActiveSpecializations();
  return NextResponse.json(specializations.map((s) => ({ id: s.id, name: s.name })));
}