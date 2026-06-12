-- CreateEnum
CREATE TYPE "moysklad_price_suggestion_status" AS ENUM ('suggested', 'confirmed', 'rejected');

-- CreateTable
CREATE TABLE "moysklad_price_suggestions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "parsed_row_id" UUID NOT NULL,
    "supplier_id" UUID,
    "product_id" TEXT NOT NULL,
    "suggested_price" DECIMAL(18,4) NOT NULL,
    "current_price" DECIMAL(18,4),
    "price_delta" DECIMAL(18,4),
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "status" "moysklad_price_suggestion_status" NOT NULL DEFAULT 'suggested',
    "confirmed_by_id" UUID,
    "confirmed_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moysklad_price_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "moysklad_price_suggestions_supplier_status_idx" ON "moysklad_price_suggestions"("supplier_id", "status");

-- CreateIndex
CREATE INDEX "moysklad_price_suggestions_product_status_idx" ON "moysklad_price_suggestions"("product_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "moysklad_price_suggestions_row_product_key" ON "moysklad_price_suggestions"("parsed_row_id", "product_id");

-- AddForeignKey
ALTER TABLE "moysklad_price_suggestions" ADD CONSTRAINT "moysklad_price_suggestions_parsed_row_id_fkey" FOREIGN KEY ("parsed_row_id") REFERENCES "parsed_price_rows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moysklad_price_suggestions" ADD CONSTRAINT "moysklad_price_suggestions_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moysklad_price_suggestions" ADD CONSTRAINT "moysklad_price_suggestions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "moysklad_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moysklad_price_suggestions" ADD CONSTRAINT "moysklad_price_suggestions_confirmed_by_id_fkey" FOREIGN KEY ("confirmed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
