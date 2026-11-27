# Paystack setup & test checklist (Primegram)

## Keys / env
Supabase → Edge Functions → Secrets (server only — never put in the app):
- `PAYSTACK_SECRET_KEY` = `sk_test_...` (switch to `sk_live_...` when live)

No Paystack key is needed in the frontend: checkout opens with a server-issued `access_code`.
Optional AI secrets: `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` (the assistant works without them).

## Paystack dashboard
1. Settings → API Keys & Webhooks → Webhook URL:
   `https://nrtvvddlnreqskzqksss.supabase.co/functions/v1/paystack-webhook`
2. Make sure KES, Mobile Money (M-Pesa) and Cards are enabled for your Kenya business.
3. Subaccount settlement bank: use `MPESA` for M-Pesa payouts, or the bank code from
   `GET https://api.paystack.co/bank?country=kenya` (verify the exact M-Pesa code for your account).

## Test mode flow
1. Creator: Settings → Creator → "Payout account (Paystack)" → save (creates the subaccount, 15% to Primegram).
2. Creator sets a monthly price in the same screen.
3. Fan: open the creator profile → Subscribe, or tap Tip on a post/track → pick M-Pesa or Card.
4. M-Pesa (test): use Paystack's test mobile-money number shown in the checkout popup and approve.
5. Card (test): 4084 0840 8408 4081, any future expiry, CVV 408, OTP 123456.
6. Confirm in Supabase → `transactions`: one row per reference with gross, 15% `platform_fee_kes`, `creator_net_kes` (after Paystack fee).
7. Re-send the same webhook from the Paystack dashboard → no second row, no double credit.
8. Wallet → Top Up → pays through Paystack and credits the wallet after confirmation.
