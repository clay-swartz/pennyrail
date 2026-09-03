# Restaurant Inventory for Wix — v0 backend

App ID is prefilled for the Wix app created on 2026-09-03.

## What this deploy proves
1. `/api/health` is live.
2. Wix webhook JWT signatures are verified.
3. `Order Approved` is received.
4. The authenticated Wix order is fetched.

## Required Vercel environment variables
- `WIX_APP_ID`
- `WIX_APP_SECRET`
- `WIX_WEBHOOK_PUBLIC_KEY`

## Required Wix permissions
- Read Orders
- Manage Restaurants — all permissions

## Webhook
Event: eCommerce → Order Approved

Callback after deploy:
`https://YOUR-VERCEL-DOMAIN.vercel.app/api/wix-order-approved`

The next module will map restaurant menu items to ingredient quantities and decrement them after each approved order.
