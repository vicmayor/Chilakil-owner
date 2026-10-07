-- The first employee-hours table was keyed by name and had no punches.
-- Those rows cannot be mapped onto employee ids, so they are cleared before the new columns.

DELETE FROM "EmployeeHoursPeriod";

-- DropIndex
DROP INDEX "EmployeeHoursPeriod_locationId_periodStart_employeeName_key";

-- AlterTable
ALTER TABLE "EmployeeHoursPeriod" DROP COLUMN "basePay",
DROP COLUMN "hours",
DROP COLUMN "source",
ADD COLUMN     "employeeId" TEXT NOT NULL,
ADD COLUMN     "grossPayEstimate" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "totalHours" DECIMAL(10,2) NOT NULL;

-- CreateTable
CREATE TABLE "EmployeeHoursDay" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "clockIn" TEXT,
    "clockOut" TEXT,
    "hours" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "EmployeeHoursDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeHoursBreak" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EmployeeHoursBreak_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeHoursDay_periodId_date_idx" ON "EmployeeHoursDay"("periodId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeHoursDay_periodId_date_key" ON "EmployeeHoursDay"("periodId", "date");

-- CreateIndex
CREATE INDEX "EmployeeHoursBreak_dayId_sortOrder_idx" ON "EmployeeHoursBreak"("dayId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeHoursPeriod_locationId_periodStart_employeeId_key" ON "EmployeeHoursPeriod"("locationId", "periodStart", "employeeId");

-- AddForeignKey
ALTER TABLE "EmployeeHoursDay" ADD CONSTRAINT "EmployeeHoursDay_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "EmployeeHoursPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeHoursBreak" ADD CONSTRAINT "EmployeeHoursBreak_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "EmployeeHoursDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
