CREATE TABLE checkout_requests (
  claim_hash TEXT PRIMARY KEY,
  stripe_session_id TEXT UNIQUE,
  price_id TEXT NOT NULL,
  environment TEXT NOT NULL CHECK(environment IN ('test','live')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE licenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  license_hash TEXT NOT NULL UNIQUE,
  license_ciphertext TEXT NOT NULL,
  email TEXT,
  stripe_customer_id TEXT,
  stripe_session_id TEXT NOT NULL UNIQUE,
  stripe_payment_intent_id TEXT,
  product_id TEXT NOT NULL,
  environment TEXT NOT NULL CHECK(environment IN ('test','live')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','refunded','revoked')),
  purchased_at TEXT NOT NULL,
  last_verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX licenses_payment ON licenses(stripe_payment_intent_id);
CREATE TABLE payment_status (
  payment_intent_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK(status IN ('failed','refunded')),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE stripe_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  processed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE rate_limits (
  bucket TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
-- No device tracking in v1. A future license_devices table can reference licenses.id.
