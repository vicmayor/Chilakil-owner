-- Shift segments, six-decimal hours, applied rates, open shifts, and sync errors.
-- Existing day rows become one segment each so the new key can be required.

ALTER TABLE "EmployeeHoursPeriod"
ALTER COLUMN "totalHours" SET DATA TYPE DECIMAL(14,6);

ALTER TABLE "EmployeeHoursDay"
ALTER COLUMN "hours" SET DATA TYPE DECIMAL(14,6);

ALTER TABLE "EmployeeHoursDay" ADD COLUMN "shiftId" TEXT;
UPDATE "EmployeeHoursDay" SET "shiftId" = 'legacy-' || "id" WHERE "shiftId" IS NULL;
ALTER TABLE "EmployeeHoursDay" ALTER COLUMN "shiftId" SET NOT NULL;

ALTER TABLE "EmployeeHoursDay" ADD COLUMN "hourlyRate" DECIMAL(10,2);
UPDATE "EmployeeHoursDay" AS day
SET "hourlyRate" = period."hourlyRate"
FROM "EmployeeHoursPeriod" AS period
WHERE period."id" = day."periodId" AND day."hourlyRate" IS NULL;
ALTER TABLE "EmployeeHoursDay" ALTER COLUMN "hourlyRate" SET NOT NULL;

ALTER TABLE "EmployeeHoursDay" ADD COLUMN "unpaidBreakMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EmployeeHoursDay" ADD COLUMN "breakTimesRecorded" BOOLEAN NOT NULL DEFAULT false;

DROP INDEX "EmployeeHoursDay_periodId_date_key";
CREATE UNIQUE INDEX "EmployeeHoursDay_periodId_shiftId_date_key" ON "EmployeeHoursDay"("periodId", "shiftId", "date");

CREATE TABLE "EmployeeHoursAppliedRate" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "hourlyRate" DECIMAL(10,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EmployeeHoursAppliedRate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmployeeHoursAppliedRate_periodId_sortOrder_idx" ON "EmployeeHoursAppliedRate"("periodId", "sortOrder");

ALTER TABLE "EmployeeHoursAppliedRate" ADD CONSTRAINT "EmployeeHoursAppliedRate_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "EmployeeHoursPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "EmployeeHoursOpenShift" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "clockIn" TEXT NOT NULL,

    CONSTRAINT "EmployeeHoursOpenShift_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmployeeHoursOpenShift_periodId_shiftId_key" ON "EmployeeHoursOpenShift"("periodId", "shiftId");

ALTER TABLE "EmployeeHoursOpenShift" ADD CONSTRAINT "EmployeeHoursOpenShift_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "EmployeeHoursPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TeamHoursSyncState" (
    "id" TEXT NOT NULL,
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastErrorAt" TIMESTAMP(3),

    CONSTRAINT "TeamHoursSyncState_pkey" PRIMARY KEY ("id")
);
