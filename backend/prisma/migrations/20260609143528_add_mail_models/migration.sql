-- CreateEnum
CREATE TYPE "mailbox_sync_status" AS ENUM ('idle', 'syncing', 'error');

-- CreateEnum
CREATE TYPE "email_link_status" AS ENUM ('auto', 'manual', 'unlinked');

-- CreateEnum
CREATE TYPE "email_direction" AS ENUM ('inbound', 'outbound');

-- CreateTable
CREATE TABLE "supplier_contacts" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "supplier_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "domain" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mailbox_connections" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "imap_host" TEXT NOT NULL,
    "imap_port" INTEGER NOT NULL DEFAULT 993,
    "imap_secure" BOOLEAN NOT NULL DEFAULT true,
    "smtp_host" TEXT NOT NULL,
    "smtp_port" INTEGER NOT NULL DEFAULT 587,
    "smtp_secure" BOOLEAN NOT NULL DEFAULT false,
    "email" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "password_encrypted" TEXT NOT NULL,
    "sync_status" "mailbox_sync_status" NOT NULL DEFAULT 'idle',
    "last_sync_at" TIMESTAMP(3),
    "last_sync_error" TEXT,
    "history_imported_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mailbox_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_threads" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "mailbox_user_id" UUID NOT NULL,
    "supplier_id" UUID,
    "subject" TEXT NOT NULL,
    "thread_key" TEXT NOT NULL,
    "link_status" "email_link_status" NOT NULL DEFAULT 'unlinked',
    "last_message_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_messages" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "thread_id" UUID NOT NULL,
    "mailbox_user_id" UUID NOT NULL,
    "imap_uid" INTEGER,
    "message_id" TEXT NOT NULL,
    "in_reply_to" TEXT,
    "from_email" TEXT NOT NULL,
    "from_name" TEXT,
    "to_emails" TEXT[],
    "subject" TEXT NOT NULL,
    "body_text" TEXT,
    "body_html" TEXT,
    "direction" "email_direction" NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL,
    "has_attachments" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_attachments" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "message_id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "storage_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_contacts_email_idx" ON "supplier_contacts"("email");

-- CreateIndex
CREATE INDEX "supplier_contacts_domain_idx" ON "supplier_contacts"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_contacts_supplier_email_key" ON "supplier_contacts"("supplier_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "mailbox_connections_user_id_key" ON "mailbox_connections"("user_id");

-- CreateIndex
CREATE INDEX "email_threads_supplier_id_idx" ON "email_threads"("supplier_id");

-- CreateIndex
CREATE INDEX "email_threads_mailbox_last_message_idx" ON "email_threads"("mailbox_user_id", "last_message_at");

-- CreateIndex
CREATE UNIQUE INDEX "email_threads_mailbox_thread_key" ON "email_threads"("mailbox_user_id", "thread_key");

-- CreateIndex
CREATE INDEX "email_messages_thread_sent_at_idx" ON "email_messages"("thread_id", "sent_at");

-- CreateIndex
CREATE INDEX "email_messages_from_email_idx" ON "email_messages"("from_email");

-- CreateIndex
CREATE UNIQUE INDEX "email_messages_mailbox_message_id_key" ON "email_messages"("mailbox_user_id", "message_id");

-- CreateIndex
CREATE INDEX "email_attachments_message_id_idx" ON "email_attachments"("message_id");

-- CreateIndex
CREATE INDEX "suppliers_email_idx" ON "suppliers"("email");

-- AddForeignKey
ALTER TABLE "supplier_contacts" ADD CONSTRAINT "supplier_contacts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailbox_connections" ADD CONSTRAINT "mailbox_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "email_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "email_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
