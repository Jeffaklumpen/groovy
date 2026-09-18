# Groovy

Groovy är en webbapp för att bygga, organisera och dela en vinylsamling. Frontenden körs som vanilla JavaScript via GitHub Pages och använder Supabase för autentisering, databas, profilbilder, RPC:er och Edge Functions.

## Lokal kontroll

Projektet har inget frontend-byggsteg. Node-regressionstesterna körs med:

```text
npm run test:node
```

Browser-smoke-testerna körs med Playwright:

```text
npm ci
npm run test:e2e
```

Supabase JS laddas i webbläsaren från CDN och är pinnad till en exakt testad version i `index.html`.

## Profilregler

| Besökare | Adress | Resultat |
| --- | --- | --- |
| Utloggad | Startsidan | Tom egen samling och möjlighet att logga in |
| Utloggad | Direkt profiladress | Omdirigering till startsidan/inloggning |
| Inloggad | Egen profiladress | Omdirigering till redigerbar egen samling |
| Inloggad | Annan profil med album | Skrivskyddad samling |
| Inloggad | Annan profil utan album | Meddelande om tom samling |
| Inloggad | Profil som inte finns | Meddelande om att användaren inte finns |

## Collection och wishlist

Albumdata är gemensam katalogdata. En vanlig klient får läsa katalogen men får inte längre skriva direkt till `artists`, `albums` eller `tracks`.

På utvecklingsbranchen `notes` går ett nytt album först genom den JWT-skyddade `discogs-search`-funktionen. Den hämtar albumidentitet och vinyl-tracklist från Discogs på serversidan, verifierar eventuell Apple-albumlänk och lämnar därefter över till service-role-only RPC:n `save_album_to_library_verified`. Den äldre `save_album_to_library` finns tills vidare kvar för bakåtkompatibilitet med `main` och tas bort från klientåtkomst när releasebranchen har flyttats över till den verifierade vägen.

Flytt från wishlist till collection går genom `move_wishlist_to_collection`, så insert, delete och omnumrering sker i samma databastransaktion.

Användarspecifika tabeller skyddas med RLS och ownership-regler.

## Supabase

- Hanterade databasändringar finns i `supabase/migrations/`.
- En återuppbyggnadsbaseline av live-schemat finns i `supabase/baseline/20260918_live_schema.sql`.
- Edge Functions finns i `supabase/functions/`.
- Direkta Data API-rättigheter är explicita i stället för att förlita sig på Supabases äldre standardgrants.

Baselinen innehåller schema och säkerhetsmodell men inte användardata eller innehållet i MusicBrainz-katalogen.

## Installation på mobil

Groovy kan installeras som webbapp på Android och läggas till på hemskärmen på iPhone. Service workern är avsiktligt nätverksbaserad och cachar inte appfiler, så publicerade uppdateringar ska slå igenom utan hård omladdning.

## Brancher och deploy

`notes` är aktiv utvecklingsbranch och `main` är stabil release-checkpoint.

GitHub Pages-konfigurationen bygger för närvarande även pushes till `notes`. Tills Pages-källan har flyttats till den avsedda release-branchen ska `notes` därför behandlas som en deployad utvecklingsmiljö, inte som en helt isolerad lokal branch.

## Arkitekturprinciper

- Nya features ska läggas i tydliga moduler i stället för att växa `app.js` av bekvämlighet.
- `app.js` är främst integrations-/composition root och ska inte delas bara för att nå ett visst filmått.
- Ny kod ska använda `GroovyRecord`-adaptern och inte läsa positionsfält som `record[10]` direkt.
- Browser-navigation har en enda ägare i `js/router.js`; övriga moduler använder `GroovyRouter` och får inte skriva direkt till `history`.
- Nya CSS-ändringar ska helst ändra den riktiga regeln i stället för att lägga ännu ett versionslager med `!important`.

Se `docs/ARCHITECTURE.md` för mer detaljer.

## Säkerhet

Den publika Supabase-nyckeln i webbkoden är en publishable klientnyckel och är avsedd att vara publik. Säkerheten ligger i explicita databasgrants, RLS, validerade RPC:er och JWT-skyddade Edge Functions.
