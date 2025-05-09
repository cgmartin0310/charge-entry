-- AlterTable
ALTER TABLE "Payer" ADD COLUMN     "defaultProcedureId" TEXT;

-- AddForeignKey
ALTER TABLE "Payer" ADD CONSTRAINT "Payer_defaultProcedureId_fkey" FOREIGN KEY ("defaultProcedureId") REFERENCES "Procedure"("id") ON DELETE SET NULL ON UPDATE CASCADE;
