<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Guest screens live under `/stay/*` (client-side auth gate in `stay.tsx`); public entry points are `/`, `/q/$token` (room QR, public info only) and `/join/$token` (personal invite). Why: QR is a doorway, never an identity.
- Anything that costs money from the concierge is a proposal card the guest confirms, then executed by server functions that recompute prices. Why: the AI never decides prices or permissions.
- Guests sign in only via `verifyStay` (invite token or room + stay code against an active stay); it creates a private per-guest account and returns a session. Public sign-up and Google are disabled. Why: only verified active-stay guests may enter.
