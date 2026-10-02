import { requireConsultant } from "@/server/authz/guards";
import { getConsultantProfile, getQualifications } from "@/server/dal/consultant-profile";
import { getActiveSpecializations, getActiveLanguages } from "@/server/dal/taxonomy";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { LANGUAGES } from "@/config/languages";
import { SPECIALIZATIONS } from "@/config/specializations";

export default async function ConsultantProfilePage() {
  const consultant = await requireConsultant();
  const profile = await getConsultantProfile(consultant.id);
  const qualifications = await getQualifications(profile?.id ?? "");
  const activeSpecs = await getActiveSpecializations();
  const activeLangs = await getActiveLanguages();

  if (!profile) {
    return (
      <Container className="flex flex-col gap-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Profile</h1>
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <p>No consultant profile found. Please complete onboarding first.</p>
          </CardContent>
        </Card>
      </Container>
    );
  }

  const statusBadges: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "success"; icon: typeof CheckCircle | typeof AlertCircle | typeof Loader2 }> = {
    PENDING: { label: "Pending Review", variant: "default", icon: Loader2 },
    APPROVED: { label: "Approved", variant: "success", icon: CheckCircle },
    REJECTED: { label: "Rejected", variant: "destructive", icon: AlertCircle },
    SUSPENDED: { label: "Suspended", variant: "destructive", icon: AlertCircle },
  };

  const status = statusBadges[profile.verificationStatus] ?? { label: profile.verificationStatus, variant: "secondary", icon: AlertCircle };

  return (
    <Container className="flex flex-col gap-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Professional Profile</h1>
      </div>

      {/* Status Banner */}
      <Card className={status.variant === "success" ? "border-success" : status.variant === "destructive" ? "border-destructive" : ""}>
        <CardContent className="flex items-center gap-4">
          <status.icon className={`h-5 w-5 ${status.variant === "success" ? "text-success" : status.variant === "destructive" ? "text-destructive" : "text-muted-foreground"}`} />
          <div>
            <p className="font-medium">Verification Status: {status.label}</p>
            {profile.verificationStatus === "REJECTED" && profile.rejectionReason && (
              <p className="text-sm text-muted-foreground mt-1">Reason: {profile.rejectionReason}</p>
            )}
            {profile.verificationStatus === "SUSPENDED" && (
              <p className="text-sm text-muted-foreground mt-1">Contact support to appeal.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Completeness Meter */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Completeness</CardTitle>
          <CardDescription>All sections must be complete before submitting for verification.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {["Personal", "Pricing", "Specializations", "Languages", "Qualifications", "Availability"].map((section) => (
              <div key={section} className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success" />
                <span className="text-sm">{section}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Profile Form Sections */}
      <form action="#" className="space-y-6">
        {/* Personal Details */}
        <Card>
          <CardHeader>
            <CardTitle>Personal Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <label htmlFor="headline" className="text-sm font-medium">Headline *</label>
                <input id="headline" defaultValue={profile.headline} className="border rounded-md px-3 py-2" />
              </div>
              <div className="grid gap-2">
                <label htmlFor="yearsOfExperience" className="text-sm font-medium">Years of Experience *</label>
                <input id="yearsOfExperience" type="number" defaultValue={profile.yearsOfExperience} className="border rounded-md px-3 py-2" />
              </div>
            </div>
            <div className="grid gap-2">
              <label htmlFor="bio" className="text-sm font-medium">Biography *</label>
              <textarea id="bio" defaultValue={profile.bio} rows={6} className="border rounded-md px-3 py-2" />
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <div className="grid gap-2">
                <label htmlFor="timezone" className="text-sm font-medium">Timezone *</label>
                <input id="timezone" defaultValue={profile.timezone} className="border rounded-md px-3 py-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Pricing & Policy */}
        <Card>
          <CardHeader>
            <CardTitle>Pricing & Policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 grid gap-4 md:grid-cols-3">
            <div className="grid gap-2">
              <label htmlFor="sessionPriceMinor" className="text-sm font-medium">Price (minor units) *</label>
              <input id="sessionPriceMinor" type="number" defaultValue={profile.sessionPriceMinor} className="border rounded-md px-3 py-2" />
            </div>
            <div className="grid gap-2">
              <label htmlFor="currency" className="text-sm font-medium">Currency *</label>
              <select id="currency" defaultValue={profile.currency} className="border rounded-md px-3 py-2">
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="CAD">CAD</option>
                <option value="AUD">AUD</option>
              </select>
            </div>
            <div className="grid gap-2">
              <label htmlFor="sessionDurationMinutes" className="text-sm font-medium">Session Duration *</label>
              <select id="sessionDurationMinutes" defaultValue={profile.sessionDurationMinutes} className="border rounded-md px-3 py-2">
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="50">50 min</option>
                <option value="60">60 min</option>
                <option value="90">90 min</option>
              </select>
            </div>
            <div className="grid gap-2">
              <label htmlFor="bufferMinutes" className="text-sm font-medium">Buffer (minutes)</label>
              <input id="bufferMinutes" type="number" defaultValue={profile.bufferMinutes} className="border rounded-md px-3 py-2" />
            </div>
            <div className="grid gap-2">
              <label htmlFor="minLeadTimeHours" className="text-sm font-medium">Lead Time (hours)</label>
              <input id="minLeadTimeHours" type="number" defaultValue={profile.minLeadTimeHours} className="border rounded-md px-3 py-2" />
            </div>
            <div className="grid gap-2">
              <label htmlFor="maxAdvanceDays" className="text-sm font-medium">Max Advance (days)</label>
              <input id="maxAdvanceDays" type="number" defaultValue={profile.maxAdvanceDays} className="border rounded-md px-3 py-2" />
            </div>
            <div className="grid gap-2">
              <label htmlFor="cancellationWindowHours" className="text-sm font-medium">Cancellation Window (hours)</label>
              <input id="cancellationWindowHours" type="number" defaultValue={profile.cancellationWindowHours} className="border rounded-md px-3 py-2" />
            </div>
            <div className="grid gap-2">
              <legend className="text-sm font-medium">Consultation Types *</legend>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked={profile.consultationTypes.includes("ONLINE")} className="rounded border-input" />
                  Online
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked={profile.consultationTypes.includes("IN_PERSON")} className="rounded border-input" />
                  In Person
                </label>
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <div className="grid gap-2">
                <label htmlFor="addressLine" className="text-sm font-medium">Address Line</label>
                <input id="addressLine" defaultValue={profile.addressLine ?? ""} className="border rounded-md px-3 py-2" />
              </div>
              <div className="grid gap-2">
                <label htmlFor="city" className="text-sm font-medium">City</label>
                <input id="city" defaultValue={profile.city ?? ""} className="border rounded-md px-3 py-2" />
              </div>
              <div className="grid gap-2">
                <label htmlFor="country" className="text-sm font-medium">Country</label>
                <input id="country" defaultValue={profile.country ?? ""} className="border rounded-md px-3 py-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Specializations */}
        <Card>
          <CardHeader>
            <CardTitle>Specializations (1–5)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {activeSpecs.map((spec) => (
                <label key={spec.id} className="flex items-center gap-2 rounded border px-3 py-1">
                  <input
                    type="checkbox"
                    defaultChecked={profile.specializationIds.includes(spec.id)}
                    value={spec.id}
                    className="rounded border-input"
                  />
                  {spec.name}
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Languages */}
        <Card>
          <CardHeader>
            <CardTitle>Languages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {activeLangs.map((lang) => (
                <label key={lang.id} className="flex items-center gap-2 rounded border px-3 py-1">
                  <input
                    type="checkbox"
                    defaultChecked={profile.languageIds.includes(lang.id)}
                    value={lang.id}
                    className="rounded border-input"
                  />
                  {lang.name}
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Qualifications */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Qualifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {qualifications.map((q) => (
                <div key={q.id} className="flex items-center justify-between p-3 border rounded-md">
                  <div>
                    <p className="font-medium">{q.title}</p>
                    <p className="text-sm text-muted-foreground">{q.institution} • {q.awardedYear}</p>
                  </div>
                </div>
              ))}
              {qualifications.length === 0 && (
                <p className="text-sm text-muted-foreground py-4">No qualifications yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Submit for Verification */}
        {profile.verificationStatus === "PENDING" || profile.verificationStatus === "REJECTED" ? (
          <Card>
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="font-medium">Ready to submit?</p>
                <p className="text-sm text-muted-foreground">
                  {profile.verificationStatus === "REJECTED" ? "Resubmit after addressing the rejection reason." : "Submit your profile for admin review."}
                </p>
              </div>
              <button type="submit" className="rounded-md px-4 py-2 bg-primary text-primary-foreground">
                {profile.verificationStatus === "REJECTED" ? "Resubmit for Verification" : "Submit for Verification"}
              </button>
            </CardContent>
          </Card>
        ) : profile.verificationStatus === "APPROVED" ? (
          <Card>
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="font-medium">Accepting bookings</p>
                <p className="text-sm text-muted-foreground">Toggle to pause without unpublishing your profile.</p>
              </div>
              <button type="button" className={`rounded-md px-4 py-2 ${profile.isAcceptingBookings ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}`}>
                {profile.isAcceptingBookings ? "Accepting Bookings" : "Not Accepting Bookings"}
              </button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-destructive">
            <CardContent>
              <p className="font-medium">Your profile is suspended.</p>
              <p className="text-sm text-muted-foreground">Contact support to appeal.</p>
            </CardContent>
          </Card>
        )}
      </form>
    </Container>
  );
}