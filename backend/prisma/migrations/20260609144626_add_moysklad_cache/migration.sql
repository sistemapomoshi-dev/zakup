-- CreateTable
CREATE TABLE "moysklad_counterparties" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moysklad_counterparties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moysklad_products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "article" TEXT,
    "barcodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "buy_price" DECIMAL(18,4),
    "sale_prices" JSONB,
    "ms_updated_at" TIMESTAMP(3),
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moysklad_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moysklad_purchase_orders" (
    "id" TEXT NOT NULL,
    "counterparty_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "moment" TIMESTAMP(3) NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moysklad_purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moysklad_purchase_positions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "purchase_order_id" TEXT NOT NULL,
    "product_id" TEXT,
    "product_name" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL,
    "price" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "moysklad_purchase_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moysklad_sync_state" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "last_full_sync_at" TIMESTAMP(3),
    "last_counterparties_sync_at" TIMESTAMP(3),
    "last_products_sync_at" TIMESTAMP(3),
    "last_purchase_orders_sync_at" TIMESTAMP(3),
    "last_error" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moysklad_sync_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "moysklad_products_code_idx" ON "moysklad_products"("code");

-- CreateIndex
CREATE INDEX "moysklad_products_article_idx" ON "moysklad_products"("article");

-- CreateIndex
CREATE INDEX "moysklad_purchase_orders_counterparty_moment_idx" ON "moysklad_purchase_orders"("counterparty_id", "moment");

-- CreateIndex
CREATE INDEX "moysklad_purchase_positions_order_id_idx" ON "moysklad_purchase_positions"("purchase_order_id");

-- CreateIndex
CREATE INDEX "moysklad_purchase_positions_product_id_idx" ON "moysklad_purchase_positions"("product_id");

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_moysklad_counterparty_id_fkey" FOREIGN KEY ("moysklad_counterparty_id") REFERENCES "moysklad_counterparties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moysklad_purchase_positions" ADD CONSTRAINT "moysklad_purchase_positions_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "moysklad_purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moysklad_purchase_positions" ADD CONSTRAINT "moysklad_purchase_positions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "moysklad_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
