# 🇪🇬 Masri Lernen – Vollversion

Kostenlose PWA zum Lernen von **Ägyptisch-Arabisch (Masri)** mit Deutsch.

## Alle Features

### Lernen
- 🃏 **Karteikarten** (Gewusst / Noch üben)
- 🔘 **Auswahl-Quiz** (4 Antworten)
- ⌨️ **Eingabe-Quiz** (Antwort eintippen)
- 📂 **11 Kategorien** + Sätze
- 🔄 **Spaced Repetition**
- ♂♀ **Geschlechts-Modus** (Mann/Frau/Beides)
- 🔀 Lernrichtung: DE→EG, EG→DE, gemischt

### Audio
- 🔊 **Web-Speech** Aussprache
- 🎙️ **Eigene Aufnahmen** pro Vokabel (authentisch!)

### Daten
- ✏️ **Vokabel-Editor** in der App
- 📄 **Excel/CSV Import** mit **Duplikat-Erkennung**
- ☁️ **Google Sheet Sync** (öffentliches Sheet)
- 🔄 **Geräte-Sync** via Google Apps Script (kostenlos)
- 📤 Backup exportieren / importieren / teilen

### Komfort
- 🎯 Tagesziel + Fortschrittsring
- 📊 **Lernverlauf-Diagramm** (14 Tage)
- 🔔 **Tägliche Erinnerung**
- 👤 **Mehrere Profile**
- 📖 **Grammatik-Basics** (5 Lektionen)
- 📱 PWA + **Offline**
- 🆓 **0 €** – alles lokal

---

## Handy-Nutzung

### Option A: Lokal (PC muss laufen)
Doppelklick **`start-server.bat`** → Adresse am Handy öffnen → „Zum Startbildschirm hinzufügen"

### Option B: Dauerhaft online (empfohlen)
Doppelklick **`deploy-github.bat`** → GitHub anmelden → fertig.

Oder siehe **`HOSTING-SCHNELLSTART.md`** (5-Minuten-Anleitung).

URL danach: `https://DEIN-USERNAME.github.io/masri-lernen/`

---

## Google Sheet Sync (Vokabeln)

1. Google Sheet mit Spalten: `kategorie, deutsch, aegyptisch, aussprache, geschlecht, typ, notiz`
2. Freigabe: **Jeder mit Link → Betrachter**
3. Sheet-ID in App → Tab **Daten** → eintragen → **Vokabeln laden**

---

## Geräte-Sync (Fortschritt + Vokabeln)

1. Code aus **`scripts/google-sync.gs`** in Google Apps Script einfügen
2. Als Web-App bereitstellen („Jeder" Zugriff)
3. URL + Passphrase in App eintragen → **Geräte-Sync**

---

## Excel-Vorlage

Tab **Daten** → **Excel-Vorlage** oder `data/vokabeln.xlsx`

---

## Technik

Vanilla JS · IndexedDB · Service Worker · SheetJS · keine Build-Tools nötig
