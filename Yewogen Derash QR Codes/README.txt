Yewogen Derash — entry QR codes
========================================

Generated: 2026-07-23T14:59:26.057Z
Base URL:  http://10.230.89.254:3000

public-site-qr.png  ->  http://10.230.89.254:3000/
admin-panel-qr.png  ->  http://10.230.89.254:3000/admin-login

!! THESE ARE LOCAL-NETWORK CODES — they are not public links.

For a phone to scan them successfully, ALL of the following must hold:
  1. The dev server is running:  npx next dev -H 0.0.0.0 -p 3000
  2. The phone is on the SAME Wi-Fi as this laptop.
  3. Windows Firewall allows inbound TCP port 3000 (private network).
  4. The laptop still has this exact IP. Wi-Fi reassigns it often —
     when it changes, update NEXT_PUBLIC_APP_URL in .env and run:
         node scripts/make-qr.mjs

Once the site is deployed, set NEXT_PUBLIC_APP_URL to the real domain
and regenerate — the codes will then work on any device, anywhere.
