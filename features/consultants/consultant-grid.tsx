"use client";

import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, X, Star } from "lucide-react";
import { consultantSearchSchema, type ConsultantSearchInput } from "@/schemas/consultant-search";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

interface PublicConsultantRow {
  id: string;
  slug: string;
  headline: string;
  userId: string;
  fullName: string;
  verificationStatus: string;
  isAcceptingBookings: boolean;
  specializations: Array<{ id: string; name: string }>;
  languages: Array<{ id: string; name: string }>;
  sessionPriceMinor: number;
  currency: string;
  sessionDurationMinutes: number;
  consultationTypes: string[];
  ratingSum: number;
  ratingCount: number;
  createdAt: Date;
}

interface ConsultantsClientProps {
  initialInput: ConsultantSearchInput;
  initialConsultants: PublicConsultantRow[];
  initialTotal: number;
  activeSpecs: Array<{ id: string; name: string }>;
  activeLangs: Array<{ id: string; name: string }>;
}

export function ConsultantsClient({
  initialInput,
  initialConsultants,
  initialTotal,
  activeSpecs: initialActiveSpecs,
  activeLangs: initialActiveLangs,
}: ConsultantsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [input, setInput] = useState<ConsultantSearchInput>(initialInput);
  const [consultants, setConsultants] = useState<PublicConsultantRow[]>(initialConsultants);
  const [total, setTotal] = useState(initialTotal);
  const [activeSpecs, setActiveSpecs] = useState<Array<{ id: string; name: string }>>(initialActiveSpecs);
  const [activeLangs, setActiveLangs] = useState<Array<{ id: string; name: string }>>(initialActiveLangs);
  const [isLoading, setIsLoading] = useState(false);
  const totalPages = Math.ceil(total / 12);

  useEffect(() => {
    const params = Object.fromEntries(searchParams.entries());
    const parsed = consultantSearchSchema.safeParse(params);
    const initialInput = parsed.success ? parsed.data : consultantSearchSchema.parse({});
    setInput(initialInput);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    async function loadData() {
      const [specs, langs, results] = await Promise.all([
        getActiveSpecializations(),
        getActiveLanguages(),
        searchConsultants(input),
      ]);
      if (!cancelled) {
        setActiveSpecs(specs.map(s => ({ id: s.id, name: s.name })));
        setActiveLangs(langs.map(l => ({ id: l.id, name: l.name })));
        setConsultants(results.consultants);
        setTotal(results.total);
        setIsLoading(false);
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, [input]);

  const updateUrl = (newInput: Partial<ConsultantSearchInput>) => {
    const merged = { ...input, ...newInput };
    setInput(merged);
    const searchParams = new URLSearchParams();
    Object.entries(merged).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "" && !(Array.isArray(value) && value.length === 0)) {
        if (Array.isArray(value)) {
          value.forEach((v) => searchParams.append(key, v));
        } else {
          searchParams.set(key, String(value));
        }
      }
    });
    router.push(`/consultants?${searchParams.toString()}`);
  };

  return (
    <Container className="flex flex-col gap-6 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Find a Consultant</h1>
          <p className="text-sm text-muted-foreground">{total} consultant{total !== 1 ? "s" : ""} available</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Filters</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => updateUrl({ q: "", specializationIds: [], languageIds: [], consultationTypes: [], priceMin: undefined, priceMax: undefined, minRating: undefined, availableWithinDays: undefined, sort: "relevance", page: 1 })}>
            <X className="h-4 w-4 mr-1" />
            Clear all
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, headline, or bio..."
                value={input.q}
                onChange={(e) => updateUrl({ q: e.target.value, page: 1 })}
                className="pl-10"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Specializations</Label>
              <div className="flex flex-wrap gap-2 mt-1 max-h-48 overflow-y-auto">
                {activeSpecs.map((spec) => (
                  <label key={spec.id} className="flex items-center gap-2 rounded border px-3 py-1">
                    <Checkbox
                      checked={input.specializationIds.includes(spec.id)}
                      onCheckedChange={(checked: boolean) => updateUrl({
                        specializationIds: checked
                          ? [...input.specializationIds, spec.id]
                          : input.specializationIds.filter((id) => id !== spec.id),
                        page: 1,
                      })}
                    />
                    <span className="text-sm">{spec.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Languages</Label>
              <div className="flex flex-wrap gap-2 mt-1 max-h-48 overflow-y-auto">
                {activeLangs.map((lang) => (
                  <label key={lang.id} className="flex items-center gap-2 rounded border px-3 py-1">
                    <Checkbox
                      checked={input.languageIds.includes(lang.id)}
                      onCheckedChange={(checked: boolean) => updateUrl({
                        languageIds: checked
                          ? [...input.languageIds, lang.id]
                          : input.languageIds.filter((id) => id !== lang.id),
                        page: 1,
                      })}
                    />
                    <span className="text-sm">{lang.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Consultation Type</Label>
              <div className="flex gap-4">
                {(["ONLINE", "IN_PERSON"] as const).map((type) => (
                  <label key={type} className="flex items-center gap-2">
                    <Checkbox
                      checked={input.consultationTypes.includes(type)}
                      onCheckedChange={(checked: boolean) => updateUrl({
                        consultationTypes: checked
                          ? [...input.consultationTypes, type]
                          : input.consultationTypes.filter((t) => t !== type),
                        page: 1,
                      })}
                    />
                    {type}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <Label className="text-sm font-medium">Price Range</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={input.priceMin ?? ""}
                  onChange={(e) => updateUrl({ priceMin: e.target.value ? Number(e.target.value) : undefined, page: 1 })}
                  className="w-24"
                />
                <span className="flex items-center text-muted-foreground">to</span>
                <Input
                  type="number"
                  placeholder="Max"
                  value={input.priceMax ?? ""}
                  onChange={(e) => updateUrl({ priceMax: e.target.value ? Number(e.target.value) : undefined, page: 1 })}
                  className="w-24"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Minimum Rating</Label>
              <Select value={input.minRating?.toString() ?? ""} onValueChange={(v) => updateUrl({ minRating: v ? Number(v) : undefined, page: 1 })}>
                <SelectTrigger>
                  <SelectValue placeholder="Any rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any</SelectItem>
                  <SelectItem value="4.5">4.5+</SelectItem>
                  <SelectItem value="4">4.0+</SelectItem>
                  <SelectItem value="3.5">3.5+</SelectItem>
                  <SelectItem value="3">3.0+</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">Available Within</Label>
              <Select value={input.availableWithinDays?.toString() ?? ""} onValueChange={(v) => updateUrl({ availableWithinDays: v ? Number(v) : undefined, page: 1 })}>
                <SelectTrigger>
                  <SelectValue placeholder="Any time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any</SelectItem>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Select value={input.sort} onValueChange={(v) => updateUrl({ sort: v as ConsultantSearchInput["sort"], page: 1 })}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">Relevance</SelectItem>
                  <SelectItem value="price_asc">Price: Low to High</SelectItem>
                  <SelectItem value="price_desc">Price: High to Low</SelectItem>
                  <SelectItem value="rating">Rating</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="flex flex-col flex-1 p-4 space-y-3">
                <div className="h-6 w-3/4 bg-muted animate-pulse rounded" />
                <div className="h-4 w-full bg-muted animate-pulse rounded" />
                <div className="flex flex-wrap gap-1">
                  <div className="h-6 w-20 bg-muted animate-pulse rounded" />
                  <div className="h-6 w-24 bg-muted animate-pulse rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : consultants.length > 0 ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {consultants.map((consultant) => (
              <Card key={consultant.id} className="flex flex-col">
                <CardContent className="flex flex-col flex-1 p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-medium text-lg">{consultant.fullName}</h3>
                    <Badge variant={consultant.isAcceptingBookings ? "success" : "secondary"}>
                      {consultant.isAcceptingBookings ? "Accepting" : "Not accepting"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{consultant.headline}</p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {consultant.specializations.slice(0, 3).map((s) => (
                      <Badge key={s.id} variant="outline" className="text-xs">{s.name}</Badge>
                    ))}
                    {consultant.specializations.length > 3 && (
                      <Badge variant="outline" className="text-xs">+{consultant.specializations.length - 3}</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {consultant.languages.slice(0, 3).map((l) => (
                      <Badge key={l.id} variant="secondary" className="text-xs">{l.name}</Badge>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-auto pt-3 border-t">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-500 fill-current" />
                      <span className="text-sm font-medium">
                        {consultant.ratingCount > 0 ? (consultant.ratingSum / (consultant.ratingCount * 10)).toFixed(1) : "—"}
                      </span>
                      <span className="text-xs text-muted-foreground">({consultant.ratingCount})</span>
                    </div>
                    <span className="text-sm font-mono text-muted-foreground">
                      {consultant.sessionPriceMinor / 100} {consultant.currency} / {consultant.sessionDurationMinutes} min
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={input.page === 1} onClick={() => updateUrl({ page: input.page - 1 })}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">Page {input.page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={input.page === totalPages} onClick={() => updateUrl({ page: input.page + 1 })}>
                Next
              </Button>
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <p className="text-lg font-medium">No consultants found</p>
            <p className="text-muted-foreground text-center max-w-md">
              Try adjusting your filters or search terms to find a match.
            </p>
            <Button variant="ghost" onClick={() => updateUrl({ q: "", specializationIds: [], languageIds: [], consultationTypes: [], priceMin: undefined, priceMax: undefined, minRating: undefined, availableWithinDays: undefined, sort: "relevance", page: 1 })}>
              Clear all filters
            </Button>
          </CardContent>
        </Card>
      )}
    </Container>
  );
}

async function getActiveSpecializations(): Promise<Array<{ id: string; name: string }>> {
  const res = await fetch("/api/consultants/specializations");
  if (!res.ok) return [];
  return res.json();
}

async function getActiveLanguages(): Promise<Array<{ id: string; name: string }>> {
  const res = await fetch("/api/consultants/languages");
  if (!res.ok) return [];
  return res.json();
}

async function searchConsultants(input: ConsultantSearchInput) {
  const params = new URLSearchParams();
  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && !(Array.isArray(value) && value.length === 0)) {
      if (Array.isArray(value)) {
        value.forEach((v) => params.append(key, v));
      } else {
        params.set(key, String(value));
      }
    }
  });
  const res = await fetch(`/api/consultants/search?${params.toString()}`);
  if (!res.ok) return { consultants: [], total: 0 };
  return res.json();
}