# Tradera search function

This function keeps the Tradera application credentials out of the browser and
returns a small, stable listing shape to the Groovy frontend.

Required Supabase Edge Function secrets:

- `TRADERA_APP_ID`
- `TRADERA_APP_KEY`

Deploy the `tradera-search` function after setting both secrets. Never put either
value in `index.html` or `js/app.js`.
