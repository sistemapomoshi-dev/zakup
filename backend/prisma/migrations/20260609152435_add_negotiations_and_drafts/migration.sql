-- CreateEnum
CREATE TYPE "email_draft_status" AS ENUM ('draft', 'pending_review', 'approved', 'rejected', 'sent');

-- CreateEnum
CREATE TYPE "draft_version_source" AS ENUM ('ai', 'user');

-- CreateEnum
CREATE TYPE "negotiation_status" AS ENUM ('active', 'closed');

-- CreateEnum
CREATE TYPE "negotiation_item_scope" AS ENUM ('supplier', 'category', 'sku');

-- CreateTable
CREATE TABLE "negotiations" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "supplier_id" UUID NOT NULL,
    "manager_id" UUID,
    "status" "negotiation_status" NOT NULL DEFAULT 'active',
    "title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "negotiations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "negotiation_strategies" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "negotiation_id" UUID NOT NULL,
    "supplier_analysis" TEXT,
    "strategy_plan" JSONB,
    "next_step" TEXT,
    "last_message_id" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "negotiation_strategies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "negotiation_items" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "negotiation_id" UUID NOT NULL,
    "scope" "negotiation_item_scope" NOT NULL,
    "sku" TEXT,
    "category" TEXT,
    "notes" TEXT,
    "target_price" DECIMAL(18,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "negotiation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_drafts" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "supplier_id" UUID NOT NULL,
    "negotiation_id" UUID,
    "thread_id" UUID,
    "trigger_message_id" UUID,
    "mailbox_user_id" UUID NOT NULL,
    "status" "email_draft_status" NOT NULL DEFAULT 'draft',
    "subject" TEXT NOT NULL,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMP(3),
    "rejected_reason" TEXT,
    "sent_at" TIMESTAMP(3),
    "sent_message_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draft_versions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "draft_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "body_text" TEXT NOT NULL,
    "source" "draft_version_source" NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "draft_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "negotiations_supplier_id_idx" ON "negotiations"("supplier_id");

-- CreateIndex
CREATE INDEX "negotiations_manager_id_idx" ON "negotiations"("manager_id");

-- CreateIndex
CREATE UNIQUE INDEX "negotiation_strategies_negotiation_id_key" ON "negotiation_strategies"("negotiation_id");

-- CreateIndex
CREATE INDEX "negotiation_items_negotiation_id_idx" ON "negotiation_items"("negotiation_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_drafts_trigger_message_id_key" ON "email_drafts"("trigger_message_id");

-- CreateIndex
CREATE INDEX "email_drafts_supplier_status_idx" ON "email_drafts"("supplier_id", "status");

-- CreateIndex
CREATE INDEX "email_drafts_status_updated_idx" ON "email_drafts"("status", "updated_at");

-- CreateIndex
CREATE INDEX "draft_versions_draft_id_idx" ON "draft_versions"("draft_id");

-- CreateIndex
CREATE UNIQUE INDEX "draft_versions_draft_version_key" ON "draft_versions"("draft_id", "version");

-- AddForeignKey
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiation_strategies" ADD CONSTRAINT "negotiation_strategies_negotiation_id_fkey" FOREIGN KEY ("negotiation_id") REFERENCES "negotiations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiation_items" ADD CONSTRAINT "negotiation_items_negotiation_id_fkey" FOREIGN KEY ("negotiation_id") REFERENCES "negotiations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_negotiation_id_fkey" FOREIGN KEY ("negotiation_id") REFERENCES "negotiations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "email_threads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_trigger_message_id_fkey" FOREIGN KEY ("trigger_message_id") REFERENCES "email_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_versions" ADD CONSTRAINT "draft_versions_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "email_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
