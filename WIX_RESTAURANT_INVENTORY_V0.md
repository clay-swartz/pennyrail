# Wix Restaurant Inventory — v0

Corrected release layered on PennyRail. Restores PennyRail root files and adds the Wix Restaurant Inventory webhook routes.

After this deploy is green, configure Wix:
- Event: eCommerce → Order Approved
- Callback: https://pennyrail.vercel.app/api/wix/restaurant-inventory/order-approved
