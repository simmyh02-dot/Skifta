// Swedish — the base language and source of truth for the message shape.
// Every other catalog (en.ts) is typed against `Messages`, so a missing or
// misspelled key is a compile-time error, not a runtime surprise.
//
// Rule from the spec (§11): NO hardcoded UI text anywhere. Everything routes
// through these catalogs via the t() helper.

const sv = {
  lang: {
    toggle: "Byt språk",
    sv: "SV",
    en: "EN",
  },

  nav: {
    features: "Funktioner",
    pricing: "Priser",
    login: "Logga in",
    cta: "Starta gratis",
    menu: "Meny",
  },

  hero: {
    pill: "Byggd för små restauranger",
    title: "Driv veckan utan pappersarbetet.",
    subtitle:
      "Skifta samlar schema, stämpelklocka och löneklara timmar i en enkel app — gjord för restauranger med 5–15 anställda, till en bråkdel av priset mot de stora systemen.",
    ctaPrimary: "Starta 30 dagar gratis",
    ctaSecondary: "Se priser",
    note: "Inget kort krävs · igång på en eftermiddag",
    mockLabel: "schema.png — veckovy",
  },

  features: {
    shifts: {
      title: "Pass & byten",
      body: "Lägg ut lediga pass, godkänn byten med ett tryck. Veckovyn personalen faktiskt läser — slut på schemaläggning i gruppchatten.",
    },
    clock: {
      title: "Stämpelklocka",
      body: "Stämpla in med QR + Face ID, eller en PIN vid disken. 0 kr per stämpling — och aldrig mer tyda en loggbok för hand.",
    },
    payroll: {
      title: "Löneklara timmar",
      body: "Timmarna summeras automatiskt, avvikelser flaggas för godkännande, export till Fortnox & Visma med ett klick. Du har kontrollen.",
    },
  },

  stats: {
    size: { value: "5–15", label: "anställda — byggd för din storlek" },
    price: { value: "3×", label: "lättare på priset än de stora systemen" },
    clock: { value: "0 kr", label: "per stämpling, alltid" },
    trial: { value: "30 dagar", label: "gratis, inget kort krävs" },
  },

  pricing: {
    title: "Ett pris per restaurang.",
    subtitle: "Inte per användare — lägg till hela teamet utan att hålla koll på mätaren.",
    perMonth: "kr / mån",
    billed: "per restaurang · faktureras månadsvis",
    cta: "Starta gratis",
    recommended: "Rekommenderas",
    bas: {
      name: "Bas",
      features: [
        "Schema & veckovy",
        "Öppna pass & byten",
        "Tillgänglighet",
        "Obegränsat antal anställda",
      ],
    },
    full: {
      name: "Fullt paket",
      features: [
        "Allt i Bas",
        "Stämpelklocka (QR + PIN)",
        "Lön & admin",
        "AI-schemaläggning",
        "Fortnox / Visma-export",
      ],
    },
  },

  ctaBand: {
    title: "Lägg loggboken på hyllan den här veckan.",
    subtitle: "Gratis i 30 dagar. Din data är din om du slutar.",
    cta: "Starta gratis",
  },

  footer: {
    copy: "© 2026 Skifta · Gjort i Sverige för små restauranger",
  },

  auth: {
    login: {
      title: "Logga in",
      subtitle:
        "Ange ditt telefonnummer eller e-post så skickar vi en engångskod.",
      contactLabel: "Telefon eller e-post",
      contactPlaceholder: "070 123 45 67",
      sendCode: "Skicka kod",
      codeTitle: "Ange koden",
      codeSubtitle: "Vi skickade en 6-siffrig kod till {contact}.",
      codeLabel: "Engångskod",
      verify: "Logga in",
      resend: "Skicka ny kod",
      back: "Tillbaka",
      sending: "Skickar …",
      verifying: "Loggar in …",
      errorContact: "Kontrollera numret eller e-posten och försök igen.",
      errorCode: "Fel eller utgången kod. Försök igen.",
      sent: "Om kontot finns har en kod skickats.",
    },
    picker: {
      title: "Välj restaurang",
      subtitle: "Du har tillgång till flera restauranger.",
    },
    logout: "Logga ut",
  },

  invite: {
    join: {
      loading: "Laddar inbjudan …",
      invalidTitle: "Länken fungerar inte",
      invalidBody:
        "Inbjudan kan ha gått ut, redan använts, eller blivit återkallad. Be ägaren skicka en ny.",
      title: "Du är inbjuden till {restaurant}",
      subtitle: "Hej {name}! Du bjuds in som {role}. Verifiera dina uppgifter för att slutföra.",
      sendCode: "Skicka verifieringskod",
      sending: "Skickar …",
      codeLabel: "Engångskod",
      verify: "Gå med",
      verifying: "Går med …",
      resend: "Skicka ny kod",
      errorCode: "Fel eller utgången kod. Försök igen.",
    },
    admin: {
      title: "Personal",
      subtitle: "Bjud in nya medarbetare med personliga, engångslänkar.",
      singleTitle: "Bjud in en person",
      namePlaceholder: "Namn",
      contactPlaceholder: "Telefon eller e-post",
      send: "Skicka inbjudan",
      bulkTitle: "Bjud in flera på en gång",
      bulkHint: "En rad per person: Namn, telefon eller e-post",
      bulkSend: "Skicka alla",
      bulkResult: "{created} inbjudningar skickade, {skipped} hoppades över.",
      errorCreate: "Kunde inte skapa inbjudan. Kontrollera uppgifterna.",
      revoke: "Återkalla",
      empty: "Inga inbjudningar än.",
      status: {
        PENDING: "Väntar",
        CONSUMED: "Godkänd",
        EXPIRED: "Utgången",
        REVOKED: "Återkallad",
      },
    },
  },

  app: {
    nav: {
      schedule: "Schema",
      clock: "Stämpla",
      profile: "Profil",
      admin: "Admin",
    },
    roles: {
      OWNER: "Ägare",
      CO_OWNER: "Delägare",
      EMPLOYEE: "Anställd",
    },
    soon: {
      title: "Inloggad",
      body: "Pass, stämpling och admin byggs härnäst. Du är inne i appskalet.",
    },
  },
};

export type Messages = typeof sv;
export default sv;
