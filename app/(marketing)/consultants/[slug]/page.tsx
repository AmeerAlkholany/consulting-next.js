import { notFound } from "next/navigation";
import { getPublicConsultantBySlug } from "@/server/dal/consultant-search";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin, Globe, Clock, Calendar } from "lucide-react";

interface ConsultantProfilePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ConsultantProfilePageProps) {
  const { slug } = await params;
  const safeProfile = await getPublicConsultantBySlug(slug);

  if (!safeProfile) {
    return { title: "Consultant Not Found" };
  }

  return {
    title: `${safeProfile.fullName} — ${safeProfile.headline}`,
    description: safeProfile.bio.slice(0, 160),
  };
}

export default async function ConsultantProfilePage({ params }: ConsultantProfilePageProps) {
  const { slug } = await params;
  const profile = await getPublicConsultantBySlug(slug);

  if (!profile) {
    notFound();
  }

  // profile is guaranteed to be non-null here because notFound() throws above
  const safeProfile = profile;

  function formatPrice(): string {
    return `${safeProfile.sessionPriceMinor / 100} ${safeProfile.currency}`;
  }

  // formatDate is intentionally left unused for future use

  return (
    <Container className="flex flex-col gap-6 py-8">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {safeProfile.fullName}
            </h1>
            <p className="text-lg text-muted-foreground mt-1">{safeProfile.headline}</p>
          </div>
          <Badge variant={safeProfile.isAcceptingBookings ? "success" : "secondary"}>
            {safeProfile.isAcceptingBookings ? "Accepting Bookings" : "Not Accepting"}
          </Badge>
        </div>

        {/* Rating */}
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-5 w-5 ${star <= Math.round(safeProfile.ratingSum / (safeProfile.ratingCount * 10) || 0) ? "text-yellow-500 fill-current" : "text-muted-foreground"}`}
              />
            ))}
          </div>
          <span className="text-sm text-muted-foreground">
            {safeProfile.ratingCount > 0
              ? (safeProfile.ratingSum / (safeProfile.ratingCount * 10)).toFixed(1)
              : "—"}{" "}
            ({safeProfile.ratingCount} reviews)
          </span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Content */}
        <div className="md:col-span-2 flex flex-col gap-6">
          {/* About */}
          <Card>
            <CardHeader>
              <CardTitle>About</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{safeProfile.bio}</p>
            </CardContent>
          </Card>

          {/* Qualifications */}
          {safeProfile.qualifications.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Qualifications</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  {safeProfile.qualifications.map((qual) => (
                    <div key={qual.id} className="flex flex-col gap-1">
                      <span className="font-medium text-sm">{qual.title}</span>
                      <span className="text-sm text-muted-foreground">
                        {qual.institution}, {qual.awardedYear}
                      </span>
                      {qual.credentialId && (
                        <span className="text-xs text-muted-foreground font-mono">
                          ID: {qual.credentialId}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reviews */}
          {safeProfile.ratingCount > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Reviews</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Reviews will be displayed here once implemented.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          {/* Booking Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">{formatPrice()}</span>
                  <span className="text-sm text-muted-foreground">/ session</span>
                </div>
                <div className="flex flex-col gap-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {safeProfile.sessionDurationMinutes} minutes
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Globe className="h-4 w-4" />
                    {safeProfile.consultationTypes.includes("ONLINE") ? "Online" : ""}
                    {safeProfile.consultationTypes.includes("IN_PERSON") ? " In-Person" : ""}
                  </div>
                  {safeProfile.addressLine && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {safeProfile.city}, {safeProfile.country}
                    </div>
                  )}
                </div>
                <Button asChild disabled={!safeProfile.isAcceptingBookings} className="w-full">
                  <a href={`/consultants/${slug}/book`}>
                    <Calendar className="h-4 w-4 mr-2" />
                    Book Appointment
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Experience</span>
                <span>{safeProfile.yearsOfExperience} years</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Timezone</span>
                <span>{safeProfile.timezone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lead Time</span>
                <span>{safeProfile.minLeadTimeHours} hours</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Advance</span>
                <span>{safeProfile.maxAdvanceDays} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cancellation</span>
                <span>{safeProfile.cancellationWindowHours} hours</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Buffer</span>
                <span>{safeProfile.bufferMinutes} minutes</span>
              </div>
            </CardContent>
          </Card>

          {/* Specializations */}
          <Card>
            <CardHeader>
              <CardTitle>Specializations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {safeProfile.specializations.map((spec) => (
                  <Badge key={spec.id} variant="outline">
                    {spec.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Languages */}
          <Card>
            <CardHeader>
              <CardTitle>Languages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {safeProfile.languages.map((lang) => (
                  <Badge key={lang.id} variant="secondary">
                    {lang.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Container>
  );
}
