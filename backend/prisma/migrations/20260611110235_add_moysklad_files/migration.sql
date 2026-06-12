-- CreateTable
CREATE TABLE "moysklad_files" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "size_bytes" INTEGER,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moysklad_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "moysklad_files_href_key" ON "moysklad_files"("href");

-- CreateIndex
CREATE INDEX "moysklad_files_entity_idx" ON "moysklad_files"("entity_type", "entity_id");
