BPS Admissions CRM - cPanel install (short version)
====================================================
1. cPanel > Domains: create sub-domain  crm.yourschool.in  (document root: anything, e.g. crm_public)
2. cPanel > File Manager: upload bps-crm-cpanel.zip to your home folder and Extract.
   You get the folder  /home/USER/bps-crm-cpanel
3. In that folder: rename .env.example to .env and fill DATABASE_URL, AUTH_SECRET, APP_URL,
   SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD.  (Enable "Show Hidden Files" in File Manager settings.)
4. cPanel > Setup Node.js App > Create Application
     Node.js version : 20 (or 22)       Application mode : Production
     Application root: bps-crm-cpanel   Application URL  : crm.yourschool.in
     Application startup file: server.js
   Create. (Do NOT click "Run NPM Install" - everything is already included.)
5. Same page > "Run JS script" > setup-db   (creates tables + your Super Admin)
   If that button is missing: cPanel > Terminal, then run the "source ..." command shown at the
   top of the Node.js App page, and:  node setup-db.js
6. Restart the app. cPanel > SSL/TLS Status > Run AutoSSL for crm.yourschool.in
7. Open https://crm.yourschool.in and log in with SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD.
