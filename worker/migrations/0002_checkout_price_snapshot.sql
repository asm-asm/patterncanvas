-- Preserve the agreed price if the catalog changes before a delayed webhook.
ALTER TABLE checkout_requests ADD COLUMN amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE checkout_requests ADD COLUMN currency TEXT NOT NULL DEFAULT '';
