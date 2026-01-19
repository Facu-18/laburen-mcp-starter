-- D1 (SQLite) schema for Laburen challenge MCP
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  size TEXT NOT NULL,
  color TEXT NOT NULL,
  stock INTEGER NOT NULL CHECK(stock >= 0),
  available INTEGER NOT NULL CHECK(available IN (0,1)),
  price_50 INTEGER NOT NULL CHECK(price_50 >= 0),
  price_100 INTEGER NOT NULL CHECK(price_100 >= 0),
  price_200 INTEGER NOT NULL CHECK(price_200 >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS carts (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cart_items (
  id TEXT PRIMARY KEY,
  cart_id TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  qty INTEGER NOT NULL CHECK(qty > 0),
  unit_price INTEGER NOT NULL CHECK(unit_price >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(cart_id, product_id),
  FOREIGN KEY(cart_id) REFERENCES carts(id) ON DELETE CASCADE,
  FOREIGN KEY(product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_products_search ON products(name, description, category);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);
