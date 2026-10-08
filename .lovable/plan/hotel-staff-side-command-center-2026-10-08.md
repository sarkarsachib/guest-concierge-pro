# Hotel staff side (Command Center)

The guest side is built. Next comes the hotel's own side, kept separate from guests and opened at `/staff`.

## What staff will get
1. **Staff sign-in**: staff accounts are created by you (the owner) and are never self-signup. Each person gets one role: owner, manager, reception, housekeeping, restaurant or spa.
2. **Dashboard** (manager/owner): occupancy, today's revenue, active guests, open requests, live orders, alerts (escalations, high-value orders waiting for approval).
3. **Task boards by role**:
   - Housekeeping: housekeeping, laundry, minibar and maintenance requests
   - Restaurant: kitchen board for orders
   - Spa: appointments
   - Reception: everything, plus escalations with the full chat
   - Staff can move items through Received → Assigned → On the way → Delivered, and guests see this live in tracking.
4. **High-value approval**: orders above the hotel's limit wait for staff approval before they are charged.
5. **Stays and guests (CRM)**: check a guest in (creates the stay plus a personal link and room code), check out, revoke links, see each guest's orders, requests, spending and chat history.
6. **Hotel settings** (owner): turn modules on or off, branding (name, tagline), Wi-Fi and contacts, edit the menu and service catalog, set the approval limit and tax, plus AI rules and a knowledge base (FAQs and policies the concierge uses).
7. **Analytics** (manager/owner): revenue by category, top items, request volume by service, peak hours, concierge conversations and escalation rate.
8. **Room QR codes**: create or rotate codes for each room, ready to print.

## Not included yet
- Online payment (needs a payment provider; charge-to-room stays the only option)
- WhatsApp bot and native apps
- Knowledge base starts with text/FAQ entries; reading uploaded PDFs comes later

## Technical details
- New tables: `user_roles` (app_role enum, `has_role`/`staff_hotel` security-definer helpers), `staff_members` (user ↔ hotel), `knowledge_entries`; `orders.approval_status` column.
- Staff RLS: SELECT on hotel-scoped tables when staff of that hotel with the matching role; writes go through `requireSupabaseAuth` server functions that check the role first, then use admin, with audit_logs.
- Staff sign-in by email/password on `/staff/login` (accounts created by the owner through a server function; public signup stays disabled). Seed one owner account for Beach View.
- Routes under `/staff/*` with a client-side gate like `/stay`; realtime subscriptions on orders/service_requests.
- The concierge reads `knowledge_entries` and respects module toggles; `placeOrderCore` marks orders over the threshold as pending approval.
