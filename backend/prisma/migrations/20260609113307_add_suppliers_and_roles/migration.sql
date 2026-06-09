-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('manager', 'approver', 'admin');

-- CreateEnum
CREATE TYPE "supplier_status" AS ENUM ('active', 'inactive');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "user_role" NOT NULL DEFAULT 'manager';

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name" TEXT NOT NULL,
    "email" TEXT,
    "status" "supplier_status" NOT NULL DEFAULT 'active',
    "moysklad_counterparty_id" TEXT,
    "assigned_manager_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_assignments" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "supplier_id" UUID NOT NULL,
    "manager_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_moysklad_counterparty_id_key" ON "suppliers"("moysklad_counterparty_id");

-- CreateIndex
CREATE INDEX "suppliers_name_idx" ON "suppliers"("name");

-- CreateIndex
CREATE INDEX "suppliers_assigned_manager_id_idx" ON "suppliers"("assigned_manager_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_assignments_supplier_manager_key" ON "supplier_assignments"("supplier_id", "manager_id");

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_assigned_manager_id_fkey" FOREIGN KEY ("assigned_manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_assignments" ADD CONSTRAINT "supplier_assignments_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_assignments" ADD CONSTRAINT "supplier_assignments_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
