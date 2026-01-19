type Env = {
  DB: D1Database;
  CHATWOOT_BASE_URL: string;
  CHATWOOT_ACCOUNT_ID: string;
  CHATWOOT_API_TOKEN: string;
};

type ProductRow = {
  id: number;
  name: string;
  description: string;
  category: string;
  size: string;
  color: string;
  stock: number;
  available: number;
  price_50: number;
  price_100: number;
  price_200: number;
};

type CartItemView = {
  product_id: number;
  qty: number;
  unit_price: number;
  name: string;
};

function unitPriceForQty(p: ProductRow, qty: number): number {
  if (qty >= 200) return p.price_200;
  if (qty >= 100) return p.price_100;
  return p.price_50;
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function getOrCreateCart(env: Env, conversationId: string): Promise<{ cartId: string }> {
  const existing = await env.DB
    .prepare("SELECT id FROM carts WHERE conversation_id = ?1")
    .bind(conversationId)
    .first<{ id: string }>();

  if (existing?.id) return { cartId: existing.id };

  const cartId = crypto.randomUUID();
  await env.DB
    .prepare("INSERT INTO carts (id, conversation_id) VALUES (?1, ?2)")
    .bind(cartId, conversationId)
    .run();

  return { cartId };
}

async function addLabelsToConversation(env: Env, conversationId: string, labelsToAdd: string[]) {
  // fail-soft: nunca romper compra por labels
  if (!env.CHATWOOT_BASE_URL || !env.CHATWOOT_ACCOUNT_ID || !env.CHATWOOT_API_TOKEN) return;

  const base = env.CHATWOOT_BASE_URL.replace(/\/$/, "");
  const url = `${base}/api/v1/accounts/${env.CHATWOOT_ACCOUNT_ID}/conversations/${conversationId}/labels`;

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "api_access_token": env.CHATWOOT_API_TOKEN,
  };

  const currentRes = await fetch(url, { headers });
  if (!currentRes.ok) return;

  const currentJson = (await currentRes.json()) as { payload?: string[] };
  const current = Array.isArray(currentJson?.payload) ? currentJson.payload : [];

  const merged = Array.from(new Set([...current, ...labelsToAdd]));

  await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ labels: merged }),
  });
}

async function getCartView(env: Env, cartId: string) {
  const items = (
    await env.DB.prepare(
      `SELECT ci.product_id, ci.qty, ci.unit_price, p.name
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       WHERE ci.cart_id = ?1
       ORDER BY p.id`
    )
      .bind(cartId)
      .all<CartItemView>()
  ).results;

  const total = items.reduce<number>((acc, it) => acc + it.qty * it.unit_price, 0);
  return { items, total };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/health") return jsonResponse({ ok: true });

    if (req.method === "GET" && url.pathname === "/tools") {
      return jsonResponse({
        tools: [
          {
            name: "list_products",
            description: "List products with optional search by name/description/category.",
            inputSchema: {
              type: "object",
              properties: {
                query: { type: "string" },
                limit: { type: "integer", minimum: 1, maximum: 50, default: 10 },
                offset: { type: "integer", minimum: 0, default: 0 },
              },
              additionalProperties: false,
            },
          },
          {
            name: "get_product",
            description: "Get detailed information for a product by id.",
            inputSchema: {
              type: "object",
              properties: { product_id: { type: "integer" } },
              required: ["product_id"],
              additionalProperties: false,
            },
          },
          {
            name: "create_cart",
            description: "Create (or return) a cart for the given conversation_id (idempotent).",
            inputSchema: {
              type: "object",
              properties: { conversation_id: { type: "string" } },
              required: ["conversation_id"],
              additionalProperties: false,
            },
          },
          {
            name: "add_to_cart",
            description: "Add product to cart with qty, validates stock and returns updated cart.",
            inputSchema: {
              type: "object",
              properties: {
                cart_id: { type: "string" },
                product_id: { type: "integer" },
                qty: { type: "integer", minimum: 1 },
                conversation_id: { type: "string", description: "Optional: for Chatwoot labels" },
              },
              required: ["cart_id", "product_id", "qty"],
              additionalProperties: false,
            },
          },
          {
            name: "get_cart",
            description: "Get cart items and totals.",
            inputSchema: {
              type: "object",
              properties: { cart_id: { type: "string" } },
              required: ["cart_id"],
              additionalProperties: false,
            },
          },
        ],
      });
    }

    if (req.method === "POST" && url.pathname === "/call") {
      const body = (await req.json().catch(() => null)) as { name?: string; arguments?: any } | null;
      const name = body?.name;
      const args = body?.arguments ?? {};

      try {
        if (name === "list_products") {
          const q = (args.query ?? "").toString().trim();
          const limit = Math.min(Math.max(Number(args.limit ?? 10), 1), 50);
          const offset = Math.max(Number(args.offset ?? 0), 0);

          const like = `%${q}%`;
          const stmt = q
            ? env.DB.prepare(
                `SELECT * FROM products
                 WHERE available = 1
                   AND (name LIKE ?1 OR description LIKE ?1 OR category LIKE ?1)
                 ORDER BY id LIMIT ?2 OFFSET ?3`
              ).bind(like, limit, offset)
            : env.DB.prepare(
                `SELECT * FROM products
                 WHERE available = 1
                 ORDER BY id LIMIT ?1 OFFSET ?2`
              ).bind(limit, offset);

          const rows = (await stmt.all<ProductRow>()).results;
          return jsonResponse({ products: rows });
        }

        if (name === "get_product") {
          const id = Number(args.product_id);
          const row = await env.DB.prepare("SELECT * FROM products WHERE id = ?1").bind(id).first<ProductRow>();
          if (!row) return jsonResponse({ error: "PRODUCT_NOT_FOUND" }, 404);
          return jsonResponse({ product: row });
        }

        if (name === "create_cart") {
          const conversationId = String(args.conversation_id);
          const cart = await getOrCreateCart(env, conversationId);
          return jsonResponse({ cart_id: cart.cartId });
        }

        if (name === "add_to_cart") {
          const cartId = String(args.cart_id);
          const productId = Number(args.product_id);
          const qty = Number(args.qty);

          const product = await env.DB.prepare("SELECT * FROM products WHERE id = ?1").bind(productId).first<ProductRow>();
          if (!product || product.available !== 1) return jsonResponse({ error: "PRODUCT_NOT_FOUND" }, 404);
          if (!Number.isFinite(qty) || qty <= 0) return jsonResponse({ error: "INVALID_QTY" }, 400);
          if (product.stock < qty) return jsonResponse({ error: "INSUFFICIENT_STOCK", stock: product.stock }, 409);

          const unitPrice = unitPriceForQty(product, qty);

          const existing = await env.DB.prepare(
            "SELECT id, qty FROM cart_items WHERE cart_id = ?1 AND product_id = ?2"
          ).bind(cartId, productId).first<{ id: string; qty: number }>();

          if (existing?.id) {
            const newQty = existing.qty + qty;
            if (product.stock < newQty) return jsonResponse({ error: "INSUFFICIENT_STOCK", stock: product.stock }, 409);

            await env.DB.prepare(
              "UPDATE cart_items SET qty = ?1, unit_price = ?2, updated_at = datetime('now') WHERE id = ?3"
            ).bind(newQty, unitPrice, existing.id).run();
          } else {
            await env.DB.prepare(
              "INSERT INTO cart_items (id, cart_id, product_id, qty, unit_price) VALUES (?1, ?2, ?3, ?4, ?5)"
            ).bind(crypto.randomUUID(), cartId, productId, qty, unitPrice).run();
          }

          if (args.conversation_id) {
            const convId = String(args.conversation_id);
            await addLabelsToConversation(env, convId, [
              "intent:purchase",
              `cart:${cartId}`,
              `product:${productId}`,
            ]);
          }

          const { items, total } = await getCartView(env, cartId);
          return jsonResponse({ cart_id: cartId, items, total });
        }

        if (name === "get_cart") {
          const cartId = String(args.cart_id);
          const { items, total } = await getCartView(env, cartId);
          return jsonResponse({ cart_id: cartId, items, total });
        }

        return jsonResponse({ error: "UNKNOWN_TOOL", name }, 400);
      } catch (err: any) {
        return jsonResponse({ error: "INTERNAL_ERROR", message: String(err?.message ?? err) }, 500);
      }
    }

    return jsonResponse({ error: "NOT_FOUND" }, 404);
  },
};
