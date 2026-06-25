# Restaurang-app — Produkt- och teknisk kravspec (MVP: webbapp)

Version: 2.0
Status: planeringsstadie, redo att brytas ner i byggbara uppgifter.
Syfte: ge Claude Code (eller annan utvecklare) full kontext för att börja bygga MVP:t utan att behöva gissa sig till beslut som redan är tagna nedan. Allt i detta dokument är beslutat. "Out of scope"-listan i sista avsnittet är lika bindande som funktionskraven — den finns för att förhindra scope creep under bygget.

---

## 1. Vision och bakgrund

En webbapp (senare ev. native app) byggd specifikt för **små restauranger**, med ursprung i ett verkligt behov: ägaren bygger detta för sin egen arbetsplats, en restaurang med två ägare. En av ägarna sköter löneadministration manuellt genom att läsa en fysisk loggbok och räkna timmar för hand. Den andra lägger ut pass och frågar personal manuellt om de vill jobba.

Målet är att ersätta papper och manuell tidsräkning med ett billigt, smidigt verktyg — INTE att bygga ett tungt enterprise-HR-system. Konkurrenter som Planday/Caspeco/Fortnox-ekosystemet är byggda för medelstora/stora kedjor och prissätts därefter (typiskt 100–300 kr/användare/månad). Detta projekt ska vara radikalt enklare och billigare, riktat mot restauranger med ungefär 5–15 anställda.

**Strategisk positionering (moat):** Konkurrensfördelen är inte priset — pris kan en etablerad aktör matcha. Fördelen är **enkelhet och nischfokus**. En stor aktör kan sänka sitt pris men kan inte enkelt göra sin produkt enklare utan att överge sin befintliga kundbas. Hela produkten ska luta in i "byggd för 5–15 anställda, inget annat". Switching cost byggs av datahistorik + att personalen redan lärt sig flödet, så onboarding och daglig användning måste vara så friktionsfri att tröskeln att byta tillbaka till papper blir psykologisk, inte teknisk.

---

## 2. Designprinciper (gäller alla beslut nedan)

- **Smidigt över avancerat.** Om en funktion kräver en manual för att förstås är den fel för denna målgrupp.
- **Mobilförst på riktigt, inte som slogan** (se avsnitt 11 för konkreta krav). De flesta anställda använder detta på telefonen.
- **Diskret komplexitet** (se avsnitt 10). Funktioner får vara kraftfulla i bakgrunden men ska aldrig göra gränssnittet rörigt — särskilt inte för anställda.
- **Bygg inte om saker som redan finns och är reglerade** (skatteberäkning, AGI-rapportering). Exportera till etablerade system (Fortnox, Visma) istället för att återuppfinna löneberäkning.
- **Appen anpassar sig till användaren, inte tvärtom.** Ekonomiansvarig ska inte behöva ändra sin nedströms-process; appen producerar underlag i det format de redan använder.
- **AI används sparsamt, billigt (Haiku-klass modell), och ALDRIG utan mänsklig bekräftelse** innan något skrivs till databasen.

---

## 3. Roller och behörigheter

### 3.1 Rollmodell
Kontot är **person-centrerat, inte restaurang-ägt**. En person kan ha medlemskap i flera restauranger samtidigt, med olika roll i varje. Datamodellen ska reflektera detta direkt (se avsnitt 9) — bygg INTE in antagandet "en användare hör till en restaurang" någonstans.

### 3.2 Roller
| Roll | Hur de tillkommer | Betalar | Tillgång |
|---|---|---|---|
| **Ägare** | Köper abonnemanget direkt på hemsidan | Ja | Allt: pass, instämpling, ekonomi/admin, kan bjuda in vem som helst till vilken roll |
| **Co-owner** | Bjuds in av ägare ELLER av en annan co-owner | Nej (delar ägarens abonnemang) | Jämställd med ägaren i alla avseenden, inklusive att bjuda in nya co-owners och anställda. Enda skillnaden: betalar inte separat. |
| **Anställd** | Bjuds in av ägare eller co-owner | Nej (gratis) | Pass-delen (eget schema, byten, förfrågningar) + instämpling (egna stämplingar). INGEN tillgång till ekonomi/admin, ser inte andras lönedata eller timmar. |

**Viktigt:** Co-owner och ägare är funktionellt identiska förutom betalningsrelationen. "Co-owner" är i praktiken bara en flagga `is_billing_owner: false` på en annars identisk admin-roll. Bygg INTE separata behörighetsträd för ägare vs co-owner.

### 3.3 Multi-restaurang-stöd
En person kan ha flera medlemskap, ett per restaurang, med olika roll i varje. Vid inloggning visas en restaurang-väljare om personen har fler än ett medlemskap, annars hoppar de direkt in.

---

## 4. Invite-systemet (säkerhetskritiskt)

### Problem som ska lösas
En delad/återanvändbar kod ("ABC123") är osäker — vem som ser koden kan gå med. Lösningen är **personliga engångslänkar**, inte delade koder.

### Flöde
1. Ägare/co-owner anger namn + telefonnummer (eller e-post) för personen som ska bjudas in, samt roll (anställd eller co-owner) och ev. kompetenstaggar (se avsnitt 7).
2. Systemet genererar en unik, slumpad engångslänk (t.ex. `dittapp.se/join/<slumpad-token>`), giltig en begränsad tid (7 dagar) och kopplad exakt till det angivna telefonnumret/e-posten och den specifika restaurangen.
3. Länken skickas via SMS eller e-post direkt till mottagaren.
4. Mottagaren öppnar länken och måste verifiera samma telefonnummer/e-post som angavs (engångskod skickad till numret/mejlet — inte BankID, se avsnitt 5) för att slutföra registreringen.
5. Token förbrukas direkt efter lyckad registrering och kan inte återanvändas. En vidarebefordrad länk går inte att slutföra eftersom verifieringssteget kräver matchning mot originalmottagarens kontaktuppgift.
6. Om personen redan har ett konto (från en annan restaurang) kopplas det nya medlemskapet till deras befintliga konto istället för att skapa ett dubblettkonto.

### Matchnings- och kollisionshantering (måste implementeras explicit)
- **Normalisering:** alla telefonnummer normaliseras till E.164-format (`+46…`) INNAN matchning och lagring. E-post normaliseras till gemener. Matchning sker alltid mot det normaliserade värdet.
- **Numret ändras mellan invite och accept:** en invite är bunden till kontaktuppgiften som angavs vid skapandet, inte till personen. Om mottagaren bytt nummer går den gamla inviten inte att slutföra — en ny invite krävs. Detta är medvetet (annars urholkas hela verifieringen).
- **Två restauranger bjuder in samma nummer:** helt giltigt och förväntat (multi-restaurang). Det skapar två `Membership`-rader på samma `User`. Konflikt kring namn löses genom att `User` äger sitt eget visningsnamn; varje restaurang kan sätta en restaurang-lokal etikett/smeknamn på personen om de vill.
- **Invite-status:** varje invite har en explicit status: `pending`, `consumed`, `expired`, `revoked`. Ägare/co-owner kan **återkalla** (`revoke`) en skickad men ännu inte förbrukad invite.

### Co-owner-inbjudan
Samma flöde med rollflaggan satt till co-owner. Ingen extra godkännandeprocess utöver att den inbjudande har behörighet att bjuda in.

### Massinbjudan (migrering)
För att ta bort onboarding-friktionen vid uppstart:
- **CSV/Excel-import** av anställda (namn + telefonnummer/e-post + ev. taggar) i ett steg.
- **"Bjud in alla på en gång":** klistra in en lista med nummer → systemet genererar och skickar alla engångslänkar samtidigt.
- Detta är INTE OCR-migrering av loggbok (som är bortvalt, se avsnitt 17) — det är ren strukturerad bulk-import och måste finnas i MVP.

---

## 5. Identitetsverifiering vid instämpling

### Beslut: inte BankID
BankID byggs INTE in, varken nu eller som roadmap-item, om inte juridiska krav uppstår (t.ex. direktrapportering till Skatteverket, vilket inte är planerat). BankID löser "bevisa vem personen är inför myndigheter/banker" — vad som behövs här är enklare: bevisa att rätt, redan känd anställd stämplar in inom ett slutet system. BankID skulle innebära kostnad per transaktion (~2–10 kr), månadsavgifter, avtal och onödig friktion.

### Metod 1 — QR-kod + Face ID/Touch ID (standardrekommendation)
- En QR-kod sitter fysiskt synlig i restaurangen (utskriven vid personalingången e.d.).
- Anställd skannar QR med telefonens kamera (webbläsarbaserad kamera-access, ingen native app krävs).
- En sida/popup öppnas, kopplad till just den restaurangen.
- Vid första användning registrerar anställd en WebAuthn-nyckel (Face ID/Touch ID/enhetens biometri) kopplad till sitt konto.
- Vid efterföljande instämplingar: skanna QR → enheten frågar efter biometri → in/utstämpling loggas.
- Säkerhetsmodell: bevisar både plats (QR finns bara i restaurangen) och identitet (biometri bunden till enheten).
- Kostnad: 0 kr per transaktion (WebAuthn är inbyggt i moderna webbläsare/OS).

**Flera enheter och enhetsbyte (måste implementeras — annars faller hela säkerhetsmodellen):**
- En `User` kan ha **flera WebAuthn-credentials** (en per enhet). Datamodellen är `User` → många credentials.
- **Re-registrering vid ny telefon:** verifiera via engångskod till registrerat nummer/mejl → registrera ny nyckel. Gammal nyckel kan behållas eller tas bort.
- **Förlorad enhet:** ägare/co-owner kan återställa (ta bort + initiera ny registrering av) en anställds nyckel, eftersom de redan är betrodda admins.

### Metod 2 — PIN-kod på delad skärm/platta (backup, viktig för MVP)
- En delad skärm/platta/dator vid disken visar ett enkelt gränssnitt.
- Anställd anger sin personliga PIN-kod (4–6 siffror, satt vid registrering).
- För ställen med dålig mobiltäckning, personal som inte vill använda egen telefon, eller som komplement till metod 1.
- **Ärlig säkerhetsnivå:** PIN är bekvämlighet, inte stark säkerhet. En PIN kan i teorin observeras eller delas. Detta accepteras medvetet. För att mildra buddy punching utan att bygga tungt: en **server-side rimlighetskoll** flaggar stämplingar som inte matchar personens schema (t.ex. instämpling när personen inte är schemalagd) — sådant syns i avvikelsehanteringen (avsnitt 6.3) i efterhand. Personlig QR på egen telefon (metod 1) är default; delad platta är fallback.

### Metod 3 — Geofencing (framtida, ej MVP)
- Appen verifierar att telefonen är inom restaurangens radie; ett tryck räcker för in/utstämpling.
- **GDPR-känsligt:** platsdata i en anställd-arbetsgivarerelation. Måste vara **strikt opt-in per anställd**, aldrig påtvingat, och alltid med QR/PIN som likvärdigt alternativ så att en anställd som tackar nej inte missgynnas. Designa för det nu, bygg det inte i MVP.

### Prestandakrav på instämpling
- **Mål: under 3 sekunder** från QR-skann (eller PIN-inmatning) till bekräftad stämpling. Detta är ett hårt designkrav, inte en ambition — om flödet är långsammare än att messa i en gruppchatt återgår personalen dit.
- **Snabbstämplingsläge:** skanna QR → en stor "Stämpla in/ut"-knapp → biometri bara om enheten kräver det. Inga extra steg, inga mellanskärmar.
- **Tydlig bekräftelse:** visuell (grön bock) + haptisk (vibration) + ev. ljud, så personalen vet att det tog utan att stirra på skärmen.
- **Fältvalidering är ett processkrav:** flödet ska testas i en faktisk restaurangmiljö under lunchrush (fettiga händer, kö av kollegor, dålig belysning) innan det låses.

---

## 6. Funktionssektioner

Appen har tre huvudsektioner. Samma kodbas, samma databas — backend avgör vad varje roll/tier får se och göra. Bygg INTE separata kodbaser för olika paket/tiers.

### 6.1 Pass-sektionen

**Vy: vecka, inte månad.** Restaurangpersonal tänker i veckor. Stor, lättläst, en kolumn per veckodag.

**Kärnfunktioner:**
- **Öppna pass:** Ägare/co-owner lägger ut ett pass utan tilldelad person ("Fredag kväll, behöver 1 person"). Notis går ut till anställda som är kvalificerade (rätt kompetenstagg, se avsnitt 7) och markerat sig tillgängliga. Antingen först-till-kvarn eller manuellt val bland intresserade — en inställning restaurangen väljer.
- **Bytesfunktion (måste vara snabbare än gruppchatt):**
  - **"Kan inte / sjuk idag"-snabbknapp:** ett tryck på ett tilldelat pass startar ett byte.
  - Ägaren väljer per situation mellan två lägen (en inställning, kan ändras per förfrågan):
    - **Riktad förfrågan:** ägaren ser listan av kvalificerade kollegor (matchade på kompetenstagg) och väljer manuellt vem som tillfrågas först. Används när ägaren inte vill att vem som helst ska "snatcha" passet.
    - **Bred förfrågan:** passet går ut till alla kvalificerade samtidigt, först-till-kvarn.
  - En kollega accepterar → ägare/co-owner godkänner med ett klick → schemat uppdateras. (Auto-godkännande för korta varsel kan vara en inställning.)
  - **Eskalering:** om ingen kvalificerad svarar inom en konfigurerbar tid eskaleras förfrågan till ägaren.
  - **Kvalifikation styrs av kompetenstaggar (avsnitt 7):** om en servitör blir sjuk får kocken ingen notis i onödan.
- **Tillgänglighet:** Varje anställd markerar generellt vilka dagar/tider de kan jobba, så ägaren slipper fråga manuellt inför varje vecka.
- **Notiser:** vid nytt schemalagt pass, ändring av befintligt pass, och när ett bytesförslag kräver svar.

**Roller i pass-sektionen:**
- Anställd: ser eget schema, begär byte, svarar på öppna pass/bytesförfrågningar, sätter egen tillgänglighet.
- Ägare/co-owner: lägger ut/redigerar/tar bort pass, godkänner byten, ser hela schemat, administrerar kompetenstaggar, kan använda AI-assisterad schemaläggning (avsnitt 8.1).

### 6.2 Instämplingssektionen

Se avsnitt 5 för verifieringsmetoder. Funktionellt:
- In/ut-stämpling med tidsstämpel, kopplad till anställd och restaurang.
- Anställd ser sin egen stämplingshistorik och ackumulerade timmar för aktuell period.
- INGEN åtkomst för anställd till andras stämplingar eller ekonomidata.

**Offline-tålighet (viktigaste tekniska tillägget):**
- Instämpling MÅSTE fungera utan uppkoppling (källarlokaler, dålig wifi). Stämplingar köas lokalt (service worker + IndexedDB) med en lokal tidsstämpel och synkas automatiskt när uppkoppling återvänder.
- Användaren ser ett lugnt, icke-skrämmande meddelande: "Du är instämplad, vi synkar när nätet är tillbaka" — aldrig ett fel som får personalen att tro att stämplingen inte gick igenom.
- En köad-men-osynkad stämpling markeras som sådan tills synk bekräftats.

**Toleransfönster mot avvikelser (ersätter naiv flaggning):**
Det är normalt att stämpla in något tidigare eller senare. Flaggning ska därför vara graderad, inte binär. Restaurangen ställer in tröskelvärdena:
- **Inom ±5–10 min (konfigurerbart):** ingen flaggning, räknas som i tid.
- **10–30 min avvikelse:** flaggas med låg prioritet/neutral färg — "se, men ingen brådska".
- **>30 min, ELLER ett upprepat mönster** (samma anställd, samma typ av avvikelse flera dagar i rad): flaggas med hög prioritet. Mönsterdetektering över tid är det som faktiskt fångar buddy punching eller verkliga problem — inte en enstaka försening.

### 6.3 Ekonomi/admin-sektionen (endast ägare och co-owner)

Sektionen som ersätter den fysiska loggboken och det manuella räknandet.

**Kärnfunktioner:**
- **Realtidsöversikt:** vem är instämplad just nu.
- **Automatisk timsammanställning:** systemet summerar arbetade timmar per anställd per period (vecka/månad) utan manuell handpåläggning.
- **Avvikelsehantering (får aldrig hopa sig tyst):**
  - Varje avvikelse har en status: `öppen`, `granskad`, `godkänd`, och en ansvarig (ägare/co-owner) som notifieras.
  - **Veckovis digest-notis** till ägaren med ogranskade avvikelser.
  - **Vid export:** ogranskade avvikelser inkluderas ALDRIG tyst. De blockerar exporten eller exkluderas explicit och markeras — en människa måste ha sett dem. INGEN tyst automatisk justering.
- **Export:** export av sammanställd timdata till Fortnox/Visma (öppna API:er) eller som nedladdningsbar fil.
- **Export-/importmallar (ekonomiansvarig ska slippa ändra sin process):**
  - **Formatväljare:** Fortnox-kompatibel, Visma-kompatibel, eller generisk CSV.
  - **"Spara som min standard":** valt/justerat format sparas som restaurangens default; behöver aldrig konfigureras om.
  - **Importera egen mall:** ladda upp ett exempel på den kolumnstruktur ekonomiansvarig redan använder (t.ex. ett Excel-ark till en redovisningsbyrå); appen returnerar framtida exports i samma struktur. Detta är ren mallhantering, ingen AI-tolkning.
- **Lönespecsutkast (AI-assisterat):** se avsnitt 8.2.
- **Adoptionsöversikt:** visar "X av Y anställda har registrerat sig och aktiverat appen", så ägaren kan se och driva på adoptionen (som inte är garanterad bara för att ägaren köpt licensen).
- **Exportera all min data:** en knapp som exporterar restaurangens fullständiga data (anställda, scheman, stämplingshistorik) som CSV/JSON. Detta är både en förtroende-/anti-inlåsningsfunktion OCH GDPR-dataportabilitet — en funktion, två problem lösta.

**Explicit avgränsning:** Appen bygger INTE egen skatteberäkning, egen AGI-rapportering, eller egen semesterlöneberäkningsmotor. Den producerar rent, korrekt underlag som matas in i/exporteras till ett etablerat system. Detta är en regulatorisk och juridisk gräns som inte ska korsas.

---

## 7. Kompetens-/tag-system

Ett litet men genomgripande system som styr pass-matchning och bytesförfrågningar.

- **Fri definition:** ägaren skapar taggar själv (t.ex. "Kök", "Disk", "Servering", "Bar"). Inga hårdkodade kategorier — varje krog organiserar sig olika.
- **Anställda taggas:** en anställd kan ha flera taggar inom en restaurang.
- **Pass kan kräva taggar:** ett pass kan kräva en eller flera kompetenstaggar.
- **Matchningslogik:** öppna pass och bytesförfrågningar går endast ut till anställda med matchande tagg. En sjuk servitörs pass når inte kockar.

Datamodell: se `Tag`, `EmployeeTag`, `Shift.required_tags` i avsnitt 9.

---

## 8. AI-integration

**Vald modell: Claude Haiku-klass** (billigast, snabbast). Uppgifterna är strukturerad extraktion/sammanställning, inte komplext resonemang — en tyngre modell vore omotiverad kostnad. Kontrollera aktuellt modell-id och pris i Anthropics dokumentation vid implementation (priser och modellnamn uppdateras; Haiku 4.5 låg vid skrivande stund på ca 1 USD/M input, 5 USD/M output).

**Absolut princip för båda AI-funktionerna: förslag → bekräftelse → utförande.** AI:n får ALDRIG skriva direkt till databasen (schema eller löneunderlag) utan ett explicit mänskligt godkännande-klick. Hårt krav — syftet är att ägaren/ekonomiansvarig aldrig ska bli osäker på eller rädd för att AI:n ändrat något oavsiktligt.

### 8.1 Naturligt språk → schemaändringar
**Användare:** ägare/co-owner.

1. Ägaren skriver fritext, t.ex. "Lägg Erik tis–tors nästa vecka, samma som förra veckan" eller "Lägg ut hela nästa vecka som förra veckan".
2. AI tolkar mot befintlig schemakontext (tidigare scheman, anställdas tillgänglighet, kompetenstaggar) och bygger ett strukturerat förslag.
3. Förslaget presenteras som ett **granskningsbart bekräftelsekort** som visar EXAKT vad som läggs till/ändras — varje pass listat med namn, datum, tid. Inte en sammanfattande mening, utan en lista.
4. Ägaren trycker "Godkänn" (skriver till databasen), "Avbryt" (inget sparas), eller "Ändra manuellt" (öppnar redigeringsläge med AI:ns förslag som start).

**Designkrav:** tvetydiga tolkningar ("samma som förra veckan" när tiderna varierade) ska SYNAS i bekräftelsekortet, inte gömmas. Hellre ett förslag ägaren måste korrigera än ett som ser säkert ut men är fel.

### 8.2 Lönespecsutkast (AI-assisterat)
**Användare:** ekonomiansvarig (ägare/co-owner).

1. AI hämtar redan strukturerad data — stämplingar för perioden (ingen handskriftstolkning behövs).
2. Tillämpar **fasta regler satta av restaurangen** (OB-tillägg, ev. övertid) — regelbaserade beräkningar, INTE AI-gissningar. AI:ns roll är att sammanställa och presentera, inte uppfinna lönereglerna. OB-regler sätts via mallar (avsnitt 13).
3. Genererar ett utkast per anställd: grundtimmar, OB-timmar, beräknad bruttolön.
4. **Transparent uträkning + spårbarhet:** utkastet visar alltid varje rad (timmar × sats + tillägg), inte bara en slutsumma, och länkar till de exakta `ClockEvent`-poster och regler det byggdes på — så ägaren kan se och fånga fel, och en disclaimer aldrig blir enda skyddet mot en beräkningsbugg.
5. Ekonomiansvarig granskar, justerar vid behov, godkänner.
6. Godkänt underlag exporteras till Fortnox/Visma eller används som underlag för manuell utbetalning.

**Vad detta INTE gör:** beräknar preliminärskatt, gör AGI-rapportering, eller hanterar semesterlöneavsättning. Se avgränsning i avsnitt 6.3.

### 8.3 AI-kostnad och fair use
AI-kostnaden är försumbar (en restaurang med 8 anställda hamnar enligt kalkyl under 1 kr/månad i ren AI-kostnad, väl under 20–30 kr/månad även med stor säkerhetsmarginal). Den verkliga kostnaden i affärsmodellen är hosting och utvecklingstid, inte tokens.
- **Prompt caching** för återanvänd systemprompt/regelkontext rekommenderas (upp till 90 % besparing på cachad input) — låg prioritet givet kostnadsnivån, men enkel vinst.
- **Mjukt fair-use-tak under trial:** under 30-dagars trial är alla AI-funktioner fullt upplåsta, men med ett mjukt tak (t.ex. ~50 AI-anrop under hela trialen — väl över normal användning). Överskridande **flaggas internt** för manuell granskning, det blir INGEN hård spärr som stör en legitim användare. Syftet är att skydda mot extremfall (bot/missbruk), inte att begränsa riktiga kunder.

---

## 9. Datamodell (översikt, ej fullständigt schema)

- **User** — person-centrerad, inte restaurang-ägd. Grunduppgifter, normaliserat telefonnummer/e-post, eget visningsnamn.
- **WebAuthnCredential** — kopplad till `User`. **Flera per User** (en per enhet). Innehåller credential-data, ej biometrin själv (den lämnar aldrig enheten).
- **PinCredential** — PIN-hash kopplad till `User` (om metod 2 används). Aldrig PIN i klartext.
- **Restaurant** — namn, adress (för ev. geofencing senare), prenumerationsstatus, tier (bas/fullt), trial-status, konfigurerbara tröskelvärden (toleransfönster, default export-format).
- **Membership** — kopplar `User` ↔ `Restaurant` med roll (owner/co-owner/employee) och `is_billing_owner`-flagga + ev. restaurang-lokal etikett för personen. Kärnan i multi-restaurang-stödet; en `User` kan ha flera.
- **Invite** — engångstoken, kopplad till namn, normaliserad kontaktuppgift, restaurant_id, avsedd roll, ev. taggar, utgångsdatum, status (`pending`/`consumed`/`expired`/`revoked`).
- **Tag** — restaurant_id, namn. Skapas fritt av ägaren.
- **EmployeeTag** — kopplar `User` ↔ `Tag` inom en restaurang (många-till-många).
- **Shift** — restaurant_id, datum/tid, tilldelad `User` (nullable för öppna pass), `required_tags`, status (öppen/tilldelad/genomförd).
- **ShiftSwapRequest** — ursprunglig `Shift`, begärande `User`, läge (riktad/bred), ev. riktad mottagare, accepterande `User`, godkännandestatus, eskaleringstid.
- **Availability** — `User` + restaurant_id + generella tillgänglighetsregler.
- **ClockEvent** — `User`, restaurant_id, in/ut, tidsstämpel, verifieringsmetod, synk-status (för offline-kö). **Append-only / oföränderlig** (se nedan).
- **ClockEventAdjustment** — en korrigering skapar en NY post som refererar till original-`ClockEvent`, vem som ändrade, när och varför. `ClockEvent` skrivs ALDRIG över. Detta gör tidsdatan revisionssäker — starkare som bevis än en loggbok, inte svagare.
- **PayrollPeriodSummary** — sammanställd data per `User` per period, inkl. flaggade avvikelser, deras status, godkännandestatus, redo för export. Länkar till de `ClockEvent`/regler den bygger på.
- **OBRuleSet** — restaurangens valda/konfigurerade OB-regelmall (avsnitt 13), versionerad så att ett löneunderlag kan spåras till vilka regler som gällde.
- **ExportTemplate** — restaurangens sparade export-format (Fortnox/Visma/egen CSV-kolumnstruktur).
- **RetentionPolicy / datafält** — se avsnitt 13 för retention och radering.

---

## 10. UI-filosofi: diskret komplexitet

En genomgående princip, inte en enskild funktion. Flera funktioner ovan (taggar, toleransfönster, riktade byten, AI-bekräftelse) är kraftfulla i bakgrunden men får ALDRIG göra gränssnittet rörigt — särskilt inte för anställda, som är de ägaren ber om en åsikt om produkten.

- **Progressiv avslöjning:** en anställd ser bara det hen behöver i stunden. Taggar, toleransfönster och bytesläge är backend-logik som styr vad som händer — de ska aldrig synas som inställningar eller koncept i en anställds vy. En anställd ser: sitt schema, en stämpla-in-knapp, en "kan inte/sjuk"-knapp. Det är allt.
- **Ägarens gränssnitt får vara rikare** (taggadmin, avvikelsegranskning, AI-bekräftelsekort, export) eftersom ägaren använder appen mer sällan men djupare. Det ska vara organiserat i tydliga sektioner, inte en enda överväldigande vy.
- **Hård regel för hela bygget:** om en ny inställning kräver att en anställd förstår ett koncept för att kunna göra sin vardagliga uppgift, är det fel lager. Det ska redan vara konfigurerat av ägaren innan den anställda öppnar appen.
- **Estetik:** proffsig, komplett, men stilren och lätt. Inga onödiga lager, inga halvfärdiga inställningar exponerade.

---

## 11. Språk och internationalisering

- **Svenska är appens grundspråk.** All text går genom en översättningsnyckel (t.ex. `t('clock_in.success')`) från dag ett — INGEN hårdkodad text i komponenter. i18n-strukturen byggs in från start så att fler språk senare blir ren tilläggsoperation, inte omskrivning.
- **Engelska** läggs till som första extra språk när det blir aktuellt (personal som inte har svenska som förstaspråk är vanligt i branschen — i18n-strukturen säkrar att detta inte blir en ombyggnad). Prioritera då personal-vyn (de högfrekventa användarna) före admin-vyn.
- **Mobilförst som konkret krav** (inte slogan):
  - Primära knappar i tumzonen (nedre tredjedelen av skärmen).
  - Enhandsanvändning ska fungera för anställdas vardagsflöden.
  - Touch-targets minst 44px.
  - Offline-tålighet enligt avsnitt 6.2.

### Landningssida (separat från appen)
- **En svensk landningssida** (ren marknadsföringssida, INTE mjukvaran) med en **diskret språkväljare** (en liten "SV / EN"-pill i hörnet). Klick byter ut all text till engelska och tillbaka, utan omladdning eller navigering — samma sida, samma layout, bara textsträngarna byts (samma `t()`-mönster).
- INTE två separata sidor/domäner: en URL ger en SEO-profil att bygga upp och mindre underhåll. De flesta riktiga kunder är svenska; engelska är för undantagsfall (en internationell betraktare eller en anställd som inte läser svenska) och förtjänar en synlig men diskret toggle, inte en jämställd huvudingång.

---

## 12. Affärsmodell

### 12.1 Köpflöde
1. Besökare landar på landningssidan (avsnitt 11).
2. Väljer paket: **Bas** (endast pass-sektionen) eller **Fullt paket** (pass + instämpling + ekonomi/admin + AI).
3. Startar gratis trial — **30 dagar**, fullt paket upplåst oavsett valt paket (så de ser hela värdet, inkl. AI). 30 dagar valt medvetet: en lönehanteringsapp måste kunna demonstrera värde över en hel lönecykel, som ofta är månadsvis. Inget kreditkort krävs för att starta.
4. **Mjuk kvalificering vid trial-start:** kräv verifierat telefonnummer + restaurangnamn/orgnr. Filtrerar bort skräp-leads utan att lägga in betalkortsfriktion.
5. Trial-AI styrs av mjukt fair-use-tak (avsnitt 8.3).
6. Vid trial-slut: påminnelse-mail dag 25–28. Om inget betalkort kopplats vid dag 30 fryses kontot (data bevaras, inloggning blockeras) tills betalning. INGEN automatisk debitering av ett kort kunden "glömt".
7. Efter betalning: konto/restaurang får vald tier, ägarrollen tilldelas köparen.

### 12.2 Teknisk arkitektur för tiers
EN kodbas, EN databas. `Restaurant` har ett `tier`-fält (bas/fullt). **Backend kontrollerar behörighet för varje API-anrop** baserat på tier + roll — inte bara frontend-döljning.
- **Behörighetskoll i ett enda middleware-lager**, inte spritt per endpoint.
- **Negativa tester är ett krav:** varje tier-låst endpoint MÅSTE ha ett test som verifierar att en Bas-tier-token får 403 på ekonomi-endpoints. "Backend kontrollerar" är ett påstående tills det finns ett test som bevisar det.

### 12.3 Prissättning (per restaurang, inte per användare)
| Paket | Förslag pris/månad | Innehåll |
|---|---|---|
| Bas | 199–299 kr/restaurang | Pass-sektionen, obegränsat antal anställda |
| Fullt paket | 449–599 kr/restaurang | + instämpling + ekonomi/admin + AI |

Pris per restaurang: enklare att förklara, känns rättvist för en liten verksamhet, och uppmuntrar inte till att hålla nere antalet registrerade anställda.
- **Årsabonnemang med rabatt** erbjuds som alternativ — lägre churn + bättre kassaflöde.

### 12.4 Distribution och retention
- **Beachhead först:** börja med den egna restaurangen + 3–5 krogar i samma stad via varm/personlig kontakt och validera att smärtpunkten är delad innan bred skalning.
- **Värvning ("bjud in en annan restaurang"):** en spårbar inbjudningslänk där en krog som värvar en annan får X månaders rabatt. Liten funktion, men gör distribution mätbar och utnyttjar att ägare känner varandra lokalt.
- **Flytta-restaurang-flöde (mot churn):** eftersom konton är person-centrerade kan en ägare som lägger ner en krog men öppnar en ny ta med sig historiken till ett nytt abonnemang istället för att börja om.

---

## 13. Juridik, GDPR och dataretention

Detta avsnitt är bindande för bygget. Konsultera jurist vid lansering — nedan är de strukturella krav appen ska uppfylla.

- **Kollektivavtal och OB-regler (`OBRuleSet`):**
  - OB-regler sätts via **förinställda mallar** som ägaren väljer (t.ex. en HRF-liknande mall), inte fri inmatning från grunden — minskar risken för felkonfiguration.
  - **Tydlig ansvarsframing vid regelinställningen** (inte bara en gömd disclaimer): det ska framgå att ägaren ansvarar för att reglerna matchar deras kollektivavtal.
  - Regeländringar **versioneras** (vem/när), så ett löneunderlag kan spåras till vilka regler som gällde när det skapades.
- **GDPR — rättslig grund, integritetspolicy, biträdesavtal:**
  - WebAuthn-nycklar är inte biometriska persppuppgifter i juridisk mening (nyckeln lämnar aldrig enheten). PIN och anställningsdata ÄR personuppgifter och kräver dokumenterad rättslig grund (sannolikt fullgörande av anställningsavtal / rättslig förpliktelse, inte samtycke, eftersom samtycke är svagt i en anställd-arbetsgivarerelation pga maktobalans), en integritetspolicy, och ett **personuppgiftsbiträdesavtal (DPA)** — appen är biträde åt restaurangen. En standard-DPA byggs in i onboarding.
- **Retention och radering (`RetentionPolicy`/datafält):**
  - `ClockEvent`/lönedata sparas så länge bokföringskrav gäller (verifiera aktuell lagstadgad period vid implementation; bokföringslagen anger flera år för visst underlag), och anonymiseras/raderas automatiskt därefter.
  - **"Anställd slutar"-flöde:** `Membership` avslutas, persondata anonymiseras enligt policy, men aggregerat löneunderlag bevaras så länge lagkrav kräver det. Implementerar "right to erasure" på ett sätt som inte krockar med bokföringskrav.
- **Löneunderlagets robusthet:** disclaimer ("ej juridiskt bindande") skyddar inte mot en beräkningsbugg — därav den transparenta, spårbara uträkningen i avsnitt 8.2.
- **`ClockEvent` som bevis:** append-only + justeringar (avsnitt 9) gör tidsdatan revisionssäker. En ägare/co-owner kan inte retroaktivt skriva över en stämpling tyst; varje korrigering är en spårbar ny post. Detta stärker arbetsgivarens position vid en tvist i stället för att försvaga den.
- **Geofencing:** strikt opt-in per anställd, med likvärdigt alternativ (avsnitt 5, metod 3). Ej i MVP.

---

## 14. Hosting, versionshantering och framtida native app

### 14.1 MVP-hosting
Vercel. Webbapp, ingen native app i MVP-fasen.

### 14.2 Versionshantering (GitHub)
- Hela projektet (spec + kod) ligger i ett **privat GitHub-repo**.
- Spec och alla framtida ändringar lagras som markdown i repot, så varje uppdatering blir en commit med ett läsbart meddelande och historiken går att rulla tillbaka om något blir fel.
- Detta är också kontinuitetslösningen mellan arbetspass: repot är den enda källan till sanning, i stället för manuellt uppladdade filer.

### 14.3 Framtida väg till App Store / Google Play (ej MVP, men designa med detta i åtanke)
- **Steg 1 — PWA:** manifest + service worker på den befintliga webbappen. Installerbar som hemskärms-ikon, fungerar offline-ish (service worker används redan för offline-kön i avsnitt 6.2). Fungerar väl på Android; kontrollera aktuellt iOS-stöd (t.ex. push-notiser) vid implementation. Ingen App Store-publicering, ingen Apple-avgift, ingen granskning. WebAuthn och kamera-access för QR fungerar i moderna mobila webbläsare utan native app — täcker troligen MVP:s behov länge.
- **Steg 2 — Native wrapper (Capacitor/React Native), om/när det blir motiverat:** paketerar webbkoden som riktig app med native QR, Face ID, riktiga push-notiser. Kräver Apple Developer (~99 USD/år), Google Play (~25 USD engång), och granskningsprocess. Vänta tills betalande kunder finns och efterfrågan på "riktig app"-känsla är bekräftad.

---

## 15. Mätbara krav och acceptanskriterier

Sammanfattning av de hårda, testbara kraven utspridda ovan — använd som checklista vid bygge:
- Instämpling: under 3 sekunder från skann/PIN till bekräftelse.
- Instämpling fungerar offline och synkar automatiskt vid återställd uppkoppling; ingen stämpling tappas.
- `ClockEvent` är oföränderlig; korrigeringar är spårbara nya poster.
- Varje tier-låst endpoint har ett negativt test (Bas-token → 403 på ekonomi-endpoints).
- Ogranskade avvikelser kan aldrig tyst hamna i ett exporterat löneunderlag.
- En `User` kan registrera flera WebAuthn-enheter och re-registrera vid telefonbyte; admin kan återställa.
- Telefonnummer normaliseras till E.164 före all matchning/lagring.
- All UI-text går via i18n-nyckel; ingen hårdkodad text.
- Bytesflödet (sjuk → förfrågan → svar → godkännande) ska i praktiken vara snabbare än att messa i en gruppchatt; verifieras i fälttest.
- Kompetenstagg-matchning: en sjuk servitörs bytesförfrågan når inte personer utan matchande tagg.

---

## 16. Referens: löneansvarigs nuvarande arbetsflöde (manuellt, idag)

Vägleder funktionsprioritering — varje steg är en potentiell tidsbesparing.

1. **Tidsinsamling** — läser fysisk loggbok, tolkar handstil. *(Löses helt av digital instämpling, avsnitt 5–6.)*
2. **Sammanställning** — summerar timmar manuellt. *(Löses av automatisk timsammanställning, 6.3.)*
3. **Klassificering** — OB-tid, övertid, sjukfrånvaro, semester. *(Delvis: regelbaserad klassificering i 6.3/8.2; sjuk/semester är framtida utbyggnad, ej MVP-kritisk.)*
4. **Avstämning mot schema** — faktisk vs schemalagd tid. *(Löses av toleransfönster + avvikelsehantering, 6.2–6.3.)*
5. **Löneberäkning** — timlön × timmar + tillägg, skatteavdrag. *(Delvis: grundberäkning i lönespecsutkast, 8.2. Skatteavdrag medvetet utanför scope.)*
6. **Semesterlöneberäkning.** *(Utanför MVP-scope; hanteras i exporterat lönesystem.)*
7. **Lönespecifikation.** *(Löses som utkast, 8.2 — slutgiltig juridiskt bindande spec genereras i ett riktigt lönesystem.)*
8. **Utbetalning.** *(Utanför scope — via bank/lönesystem som idag.)*
9. **Rapportering till myndigheter (AGI m.m.).** *(Utanför scope — via Fortnox/Visma efter export.)*

**Slutsats:** störst värde i steg 1–4. Steg 5 görs delvis. Steg 6–9 byggs medvetet INTE — appen levererar rent underlag till befintliga, betrodda system.

---

## 17. Vad är INTE i MVP-scope

Listat explicit för att undvika scope creep under bygget:
- BankID-integration (permanent avgränsat, se avsnitt 5).
- Egen skatteberäkning, AGI-rapportering, semesterlöneberäkningsmotor (6.3, 8.2, 16).
- Chatbot för anställda — ren statistik/uppslagning löses bättre och billigare med en vanlig statistiksida/dashboard.
- Smart bemanningsförslag baserat på historisk omsättning.
- Avvikelsetolkning/mönsteranalys utöver den enkla regelbaserade flaggningen i 6.2 (ingen AI-driven mönsteranalys).
- OCR-migrering av historisk loggbok (men strukturerad bulk-import av anställda finns, avsnitt 4).
- Geofencing-baserad instämpling (avsnitt 5, metod 3 — designa för det, bygg det inte än).
- Native app / App Store-publicering (avsnitt 14 — PWA räcker för MVP).
- Separata kodbaser per paket/tier (en kodbas, behörighetsstyrning i backend).
- Fler språk än svenska i appens UI vid MVP-lansering (men i18n-strukturen finns från start, avsnitt 11).
