Yewogen Derash - QR codes
=========================

public-site-qr.png  ->  http://10.38.57.254:3000
admin-panel-qr.png  ->  http://10.38.57.254:3000/admin-login

These currently point at your LOCAL network address, so they only work on a
phone connected to the SAME Wi-Fi while the dev server is running.

AFTER YOU DEPLOY (Vercel + your domain):
  Regenerate them so they point at the real site. Either:
   - open Admin -> QR codes and click 'Download PNG' for each, or
   - set NEXT_PUBLIC_APP_URL to your live domain and re-run this generator.

The admin QR opens the staff sign-in (2FA required) - keep it internal.