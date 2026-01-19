# Laburen MCP Starter (Cloudflare Workers + D1)

## Prereqs
- Node 18+
- Cloudflare account
- Wrangler installed: `npm i -g wrangler`

## 1) Create D1 database
```bash
wrangler d1 create laburen_products_db
```
Copy the `database_name` and `database_id` into `wrangler.toml` (replace placeholders).

## 2) Apply schema + seed data
```bash
npm i
npm run db:migrate
npm run db:seed
```

## 3) Configure Chatwoot (labels)
In Cloudflare Dashboard > Workers & Pages > your worker > Settings > Variables:
- CHATWOOT_BASE_URL = https://chatwootchallenge.laburen.com
- CHATWOOT_ACCOUNT_ID = (find in Chatwoot URL / UI)
- CHATWOOT_API_TOKEN = (create in Chatwoot profile/settings)

**Do not commit real tokens.**

## 4) Run locally
```bash
npm run dev
```
Test:
- GET http://localhost:8787/health
- GET http://localhost:8787/tools
- POST http://localhost:8787/call

## 5) Deploy
```bash
npm run deploy
```

## 6) Connect MCP in Laburen
Use your deployed Worker URL as MCP base.
Tools endpoint: `/tools`
Call endpoint: `/call`

(Adjust these paths if Laburen expects a different MCP transport.)
