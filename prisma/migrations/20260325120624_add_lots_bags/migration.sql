-- CreateTable
CREATE TABLE "InspectionBag" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "bagNumber" INTEGER NOT NULL,
    "grossWeight" DOUBLE PRECISION,
    "netWeight" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionBag_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "InspectionBag" ADD CONSTRAINT "InspectionBag_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "InspectionLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
