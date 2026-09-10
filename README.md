# Groovy

Groovy är en enkel webbapp för att bygga och visa en vinylsamling. Sidan körs via GitHub Pages och använder Supabase för inloggning, databas, profilbilder och Discogs-sökning.

## Lokal kontroll

Projektet kräver inget byggsteg. JavaScript-testerna körs med Node.js:

```text
node --test tests/route-state.test.js
```

## Profilregler

| Besökare | Adress | Resultat |
| --- | --- | --- |
| Utloggad | Startsidan | Tom egen samling och möjlighet att logga in |
| Utloggad | Direkt profiladress | Uppmaning att logga in eller skapa konto |
| Inloggad | Egen profiladress | Omdirigering till redigerbar egen samling |
| Inloggad | Annan profil med album | Skrivskyddad samling |
| Inloggad | Annan profil utan album | Meddelande om tom samling |
| Inloggad | Profil som inte finns | Meddelande om att användaren inte finns |

## Säkert arbetssätt

Gör ändringar på en separat gren och skapa en pull request mot `databas`. Kontrollera sidan lokalt innan grenen slås ihop. GitHub Pages-sidan påverkas först när ändringen har slagits ihop i den gren som publiceras.

## Kända förbättringsområden

- Databasschemat och Supabase RLS-policyerna finns inte i repot och behöver dokumenteras innan databasflöden ändras.
- När ett album läggs till görs flera separata databasoperationer. En Supabase-funktion/transaktion skulle göra flödet säkrare mot halvfärdiga poster.
- Sorteringsordningen sparas en post i taget. En samlad databasoperation skulle ge bättre prestanda för stora samlingar.
- Användarsökningen gör en extra antalsfråga per användare. En vy eller RPC i Supabase kan ersätta detta.
- `js/app.js` är fortfarande stor. Den bör delas upp stegvis först när fler tester täcker befintligt beteende.

Den publika Supabase-nyckeln i webbkoden är en klientnyckel. Säkerheten måste därför alltid ligga i korrekta RLS-policyer i Supabase.
