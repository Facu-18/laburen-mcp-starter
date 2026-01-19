# Laburen Challenge – MCP + Agent (Concept)

## Flow
```mermaid
flowchart TD
  A[User explores] --> B[Agent understands intent]
  B -->|Explore| C[/tool: list_products/]
  C --> D[Agent shows options + clarifies]
  D -->|Details| E[/tool: get_product/]
  D -->|Buy| F[/tool: create_cart/]
  F --> G[/tool: add_to_cart/]
  G --> H[/tool: get_cart/]
  H --> I[Agent confirms cart + total]
  I -->|Handoff| J[Chatwoot human + labels]
```

## Tools (MCP)
- list_products(query?, limit?, offset?)
- get_product(product_id)
- create_cart(conversation_id)
- add_to_cart(cart_id, product_id, qty, conversation_id?)
- get_cart(cart_id)

## Notes
- 1 cart per conversation (create_cart is idempotent)
- add_to_cart validates stock and applies tiered unit price:
  - qty >= 200 => price_200
  - qty >= 100 => price_100
  - else => price_50
