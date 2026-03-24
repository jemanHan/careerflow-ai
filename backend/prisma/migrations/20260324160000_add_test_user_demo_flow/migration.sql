-- CreateTable
CREATE TABLE "TestUser" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TestUser_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Application" ADD COLUMN "testUserId" TEXT;

-- CreateIndex
CREATE INDEX "Application_testUserId_createdAt_idx" ON "Application"("testUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "Application"
ADD CONSTRAINT "Application_testUserId_fkey"
FOREIGN KEY ("testUserId") REFERENCES "TestUser"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
