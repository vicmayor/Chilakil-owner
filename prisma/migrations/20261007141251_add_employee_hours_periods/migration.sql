-- CreateEnum
CREATE TYPE "EmployeeHoursStatus" AS ENUM ('pending', 'approved');

-- CreateTable
CREATE TABLE "EmployeeHoursPeriod" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "periodStart" TEXT NOT NULL,
    "periodEnd" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "hours" DECIMAL(10,2) NOT NULL,
    "hourlyRate" DECIMAL(10,2) NOT NULL,
    "basePay" DECIMAL(10,2) NOT NULL,
    "status" "EmployeeHoursStatus" NOT NULL,
    "source" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeHoursPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeHoursPeriod_locationId_periodStart_idx" ON "EmployeeHoursPeriod"("locationId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeHoursPeriod_locationId_periodStart_employeeName_key" ON "EmployeeHoursPeriod"("locationId", "periodStart", "employeeName");

-- AddForeignKey
ALTER TABLE "EmployeeHoursPeriod" ADD CONSTRAINT "EmployeeHoursPeriod_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
