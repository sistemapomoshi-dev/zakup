-- CreateEnum
CREATE TYPE "attachment_parse_status" AS ENUM ('pending', 'parsing', 'parsed', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "parsed_price_source" AS ENUM ('excel', 'csv', 'pdf', 'ocr');

-- AlterTable
ALTER TABLE "email_attachments" ADD COLUMN     "parse_error" TEXT,
ADD COLUMN     "parse_status" "attachment_parse_status" NOT NULL DEFAULT 'pending',
ADD COLUMN     "parsed_at" TIMESTAMP(3),
ADD COLUMN     "row_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "parsed_price_rows" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "attachment_id" UUID NOT NULL,
    "row_index" INTEGER NOT NULL,
    "sku" TEXT,
    "name" TEXT,
    "unit" TEXT,
    "quantity" DECIMAL(18,4),
    "price" DECIMAL(18,4),
    "currency" TEXT DEFAULT 'RUB',
    "source" "parsed_price_source" NOT NULL,
    "raw_values" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parsed_price_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "parsed_price_rows_attachment_id_idx" ON "parsed_price_rows"("attachment_id");

-- CreateIndex
CREATE INDEX "email_attachments_parse_status_idx" ON "email_attachments"("parse_status");

-- AddForeignKey
ALTER TABLE "parsed_price_rows" ADD CONSTRAINT "parsed_price_rows_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "email_attachments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
