-- CreateEnum
CREATE TYPE "marketplace" AS ENUM ('wildberries', 'ozon', 'yandex_market', 'megamarket', 'aliexpress', 'website');

-- CreateEnum
CREATE TYPE "product_market_link_source" AS ENUM ('auto_barcode', 'auto_article', 'manual');

-- CreateTable
CREATE TABLE "product_market_links" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "product_id" TEXT NOT NULL,
    "marketplace" "marketplace" NOT NULL,
    "external_id" TEXT,
    "product_url" TEXT,
    "title" TEXT,
    "source" "product_market_link_source" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_market_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retail_price_snapshots" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "link_id" UUID NOT NULL,
    "price" DECIMAL(18,4) NOT NULL,
    "original_price" DECIMAL(18,4),
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retail_price_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retail_sync_state" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "last_full_sync_at" TIMESTAMP(3),
    "links_synced" INTEGER NOT NULL DEFAULT 0,
    "snapshots_saved" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retail_sync_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_market_links_product_id_idx" ON "product_market_links"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_market_links_product_marketplace_key" ON "product_market_links"("product_id", "marketplace");

-- CreateIndex
CREATE INDEX "retail_price_snapshots_link_fetched_idx" ON "retail_price_snapshots"("link_id", "fetched_at");

-- AddForeignKey
ALTER TABLE "product_market_links" ADD CONSTRAINT "product_market_links_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "moysklad_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retail_price_snapshots" ADD CONSTRAINT "retail_price_snapshots_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "product_market_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;
