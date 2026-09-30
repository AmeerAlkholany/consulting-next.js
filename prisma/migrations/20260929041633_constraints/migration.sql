CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Appointment" ADD CONSTRAINT "appointment_consultant_no_overlap"
  EXCLUDE USING gist ("consultantProfileId" WITH =,
                      tstzrange("startsAt", "endsAt", '[)') WITH &&)
  WHERE (status IN ('PENDING', 'CONFIRMED'));

ALTER TABLE "Appointment" ADD CONSTRAINT "appointment_client_no_overlap"
  EXCLUDE USING gist ("clientProfileId" WITH =,
                      tstzrange("startsAt", "endsAt", '[)') WITH &&)
  WHERE (status IN ('PENDING', 'CONFIRMED'));

ALTER TABLE "Appointment" ADD CONSTRAINT "appointment_end_after_start"
  CHECK ("endsAt" > "startsAt");

ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "rule_minutes_valid"
  CHECK ("startMinute" >= 0 AND "endMinute" <= 1440 AND "startMinute" < "endMinute");

ALTER TABLE "Review" ADD CONSTRAINT "review_rating_range"
  CHECK (rating BETWEEN 1 AND 5);

ALTER TABLE "ConsultantProfile" ADD CONSTRAINT "consultant_price_positive"
  CHECK ("sessionPriceMinor" > 0);

CREATE INDEX "notification_unread_idx" ON "Notification" ("userId") WHERE "readAt" IS NULL;

CREATE INDEX "consultant_search_idx" ON "ConsultantProfile"
  USING gin (to_tsvector('english', headline || ' ' || bio));
