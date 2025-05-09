/*
  Warnings:

  - You are about to drop the column `provider` on the `Charge` table. All the data in the column will be lost.
  - Added the required column `providerId` to the `Charge` table without a default value. This is not possible if the table is not empty.

*/
-- First, create a default provider
INSERT INTO "Provider" (id, "firstName", "lastName", status, "createdAt", "updatedAt")
VALUES ('00000000-0000-0000-0000-000000000000', 'Default', 'Provider', 'active', NOW(), NOW());

-- AlterTable
ALTER TABLE "Charge" ADD COLUMN "providerId" TEXT;

-- Update existing charges to use the default provider
UPDATE "Charge" SET "providerId" = '00000000-0000-0000-0000-000000000000' WHERE "providerId" IS NULL;

-- Make providerId required
ALTER TABLE "Charge" ALTER COLUMN "providerId" SET NOT NULL;

-- Drop the old provider column
ALTER TABLE "Charge" DROP COLUMN "provider";

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
