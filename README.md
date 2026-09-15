

## Private Whop checkout test

The normal public page still uses the existing PayPal checkout. The Whop integration is intentionally hidden while fulfillment is being verified.

After deploying this build, open:

`https://loners-corner-license-server.github.io/rok-task-manager/?whoptest=1#subscribe`

The private Whop panel will create a server-side checkout, keep the one-time claim token in `sessionStorage`, redirect to Whop in the same tab, and automatically claim the license when Whop returns to `?whop=complete`. The claim token is never placed in the URL.

Do not make the Whop panel public until the controlled payment/fulfillment test has passed.


## Whop sandbox test mode

Private test URL: `?whoptest=1#subscribe`

This build sends only the private Whop test flow to `https://loners-corner-license-sandbox.onrender.com`. The normal PayPal storefront remains unchanged. Whop sandbox payments use fake money only.
