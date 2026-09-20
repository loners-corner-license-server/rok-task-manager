# ROK Task Manager Website

## Production checkout

The public website offers two payment choices:

- Whop: automatic monthly subscription.
- PayPal: $50 USD one-time payment for 30 days using server-created PayPal Orders v2 checkout.

Whop uses the existing production create-checkout / claim-license flow. PayPal creates the fixed-price order on the production Loner's Corner licensing server, then captures and verifies the approved order server-side before displaying the LC-ROK license key and private download access.

Production licensing server:

`https://loners-corner-license-server.onrender.com`

The PayPal Transaction ID verifier and LC-ROK recovery remain available only as fallback recovery paths. No payment-provider secrets are stored in these website files.

## v8.5
- Replaced PayPal Hosted Button fulfillment with automatic Orders v2 create/capture checkout.
- Added capture retry and same-tab recovery for an approved order when the licensing server is temporarily unreachable.
- Added a small manual Transaction ID fallback for completed legacy/problem payments.
- Preserved same-key PayPal renewal and existing Whop checkout.
- Preserved the simplified task-focused v8.4 public page.

## v8.7 temporary PayPal availability notice

- New PayPal subscription checkout is temporarily disabled.
- The public PayPal panel displays “Temporarily Unavailable” and directs new customers to Whop.
- Whop checkout and Whop recovery are unchanged.
- Legacy one-time PayPal purchase recovery remains available for existing customers.
- No production licensing-server or paid EXE changes are included in this website-only package.
