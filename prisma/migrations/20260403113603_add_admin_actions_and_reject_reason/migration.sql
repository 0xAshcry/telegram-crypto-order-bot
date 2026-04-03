-- CreateEnum
CREATE TYPE "AdminActionType" AS ENUM ('APPROVE', 'REJECT');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "rejectReason" TEXT;

-- CreateTable
CREATE TABLE "AdminAction" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "adminName" TEXT NOT NULL,
    "actionType" "AdminActionType" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAction_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AdminAction" ADD CONSTRAINT "AdminAction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
