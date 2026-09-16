# ROK Task Manager Website

## Production checkout

The public website uses Whop for the $50/month ROK Task Manager subscription.

The browser calls the production Loner's Corner licensing server to create a Whop checkout. A one-time claim token is kept in `sessionStorage` in the same browser tab and is not placed in the URL. When Whop redirects the customer back with `?whop=complete`, the site verifies fulfillment with the production licensing server and displays the issued license key and private download access.

Production licensing server:

`https://loners-corner-license-server.onrender.com`

The public website uses Whop for checkout and license fulfillment. These website files do not modify the licensing server or desktop application.
