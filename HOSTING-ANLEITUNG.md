# 🌐 Online hosten + Offline lernen – Schritt für Schritt

**Kosten: 0 €** · Dauer: ca. 15 Minuten (einmalig)

---

## Das Konzept

| Was | Wie |
|-----|-----|
| **Überall online** | App liegt auf GitHub Pages (HTTPS-URL) |
| **Offline lernen** | PWA installieren + „Offline-Paket laden" |
| **Vokabellisten** | Excel/CSV importieren oder Google Sheet |
| **Offizielle Aussprache** | MP3-Dateien im Ordner `audio/` |

**Wichtig:** Offline funktioniert nur, wenn du die App **einmal online** geöffnet und installiert hast. Danach: Vokabeln, Fortschritt und Audio bleiben auf dem Handy.

---

## Teil 1: Online hosten (GitHub Pages)

### Schritt 1 – GitHub-Konto
1. Gehe zu [https://github.com/signup](https://github.com/signup) (kostenlos)
2. E-Mail bestätigen

### Schritt 2 – Neues Repository
1. Klick auf **„New repository"**
2. Name: z.B. `masri-lernen`
3. **Public** wählen
4. **Create repository**

### Schritt 3 – Dateien hochladen
1. Im neuen Repo: **„uploading an existing file"**
2. **Alle Dateien** aus diesem Ordner hochladen:
   ```
   C:\Users\Dell Presicion Tower\aegyptisch-lernen
   ```
   **Nicht** hochladen: `node_modules/` (falls vorhanden)
3. Commit: „Initial upload"

### Schritt 4 – GitHub Pages aktivieren
1. Repo → **Settings** → **Pages**
2. Unter **Build and deployment** → Source: **GitHub Actions**
3. Beim nächsten Push deployt `.github/workflows/pages.yml` automatisch

**Schnellster Weg:** Doppelklick **`deploy-github.bat`** (führt Anmeldung + Upload aus)

**Alternativ (ohne CLI):**
1. Settings → Pages → Source: **Deploy from branch**
2. Branch: `main` → Folder: `/ (root)` → Save

### Schritt 5 – Deine URL
Nach 1–2 Minuten erreichbar unter:
```
https://DEIN-USERNAME.github.io/masri-lernen/
```
Diese URL auf dem Handy speichern!

---

## Teil 2: App auf dem Handy installieren (Offline-Basis)

### Android (Chrome)
1. URL öffnen
2. Menü (⋮) → **„Zum Startbildschirm hinzufügen"** / **„App installieren"**
3. Fertig – Icon auf dem Home-Bildschirm

### iPhone (Safari)
1. URL in **Safari** öffnen (nicht Firefox!)
2. Teilen ↗ → **„Zum Home-Bildschirm"**

---

## Teil 3: Offline-Paket laden (einmalig, mit Internet)

1. App öffnen (installierte Version)
2. Tab **„Meine Wörter"**
3. Optional: **„Vokabel-Paket laden"** (~6.300 Wörter mit Audio)
4. **„Offline-Paket laden"** tippen
5. Warten bis „Offline bereit" erscheint
6. **Flugmodus testen** – App sollte weiter funktionieren

Was gespeichert wird:
- ✅ App-Oberfläche
- ✅ Alle Vokabeln (IndexedDB)
- ✅ Sprachdateien aus `audio/`
- ✅ Lernfortschritt (bleibt lokal auf dem Gerät)

---

## Teil 4: Vokabellisten einbringen

### Option A – Excel (empfohlen)
1. `data/vokabeln.xlsx` bearbeiten oder Vorlage in der App laden
2. Spalten:
   ```
   kategorie | deutsch | aegyptisch | aussprache | geschlecht | typ | notiz | audio_datei
   ```
3. In der App: **Meine Wörter → Excel hochladen**

### Option B – Google Sheet (Sync von überall)
1. Sheet mit gleichen Spalten erstellen
2. Freigabe: **Jeder mit Link → Betrachter**
3. Sheet-ID in App eintragen → **„Vokabeln laden"**
4. Am PC pflegen, am Handy syncen (wenn online)

### Option C – Direkt in der App
Tab **Meine Wörter** → Formular „Neue Vokabel eintragen"

### Option D – Gratis Vokabel-Paket
Tab **Meine Wörter** → **„Vokabel-Paket laden"** (~6.300 Wörter mit Lingualism-Audio)

---

## Teil 5: Offizielle Sprachdateien (MP3)

### Ordner-Struktur
```
aegyptisch-lernen/
└── audio/
    ├── brot.mp3
    ├── wasser.mp3
    └── danke.mp3
```

### In Excel verknüpfen
| deutsch | aegyptisch | audio_datei |
|---------|------------|-------------|
| Brot | عيش | brot.mp3 |
| Wasser | مية | wasser.mp3 |

### Audio-Quellen (Privatgebrauch)
- **Selbst aufnehmen** (beste Qualität für Masri!)
- **[Forvo.com](https://forvo.com)** – Muttersprachler-Aussprache
- **Eigene Reise-Aufnahmen**

### Hochladen zu GitHub
1. MP3s in Ordner `audio/` legen
2. Zu GitHub hochladen (gleiches Repo)
3. App neu laden → **Offline-Paket laden**

### Alternative: Audio direkt am Handy
- **Meine Wörter → Sprachdateien hochladen** (mehrere MP3s)
- **Aufnahme-Assistent** für fehlende Aufnahmen
- Dateiname = Vokabel-ID (`l1.mp3`) oder deutscher Begriff (`brot.mp3`)
- Wird in der App gespeichert (ohne GitHub)

### Wiedergabe-Reihenfolge
1. 🎵 **Offizielle MP3** (Ordner `audio/` oder Upload)
2. 🎙️ **Eigene Aufnahme** (beim Lernen aufgenommen)
3. 🔊 **Computer-Stimme** (Fallback)

---

## Teil 6: Vokabeln + Audio aktualisieren

1. Excel/MP3s auf GitHub aktualisieren
2. App online öffnen → neu importieren oder Sheet syncen
3. **Offline-Paket erneut laden**

---

## Kurz-Checkliste

- [ ] GitHub Repo erstellt & Dateien hochgeladen
- [ ] GitHub Pages aktiv → URL funktioniert
- [ ] App auf Handy installiert (Startbildschirm)
- [ ] Vokabelliste importiert
- [ ] MP3s in `audio/` + Spalte `audio_datei`
- [ ] Offline-Paket geladen
- [ ] Flugmodus-Test bestanden ✈️

---

## Häufige Fragen

**Brauche ich Internet zum Lernen?**  
Nein – nach Installation + Offline-Paket.

**Kann ich vom PC und Handy syncen?**  
Fortschritt: Backup exportieren/teilen oder Google Apps Script (siehe `scripts/google-sync.gs`).  
Vokabeln: Google Sheet oder GitHub.

**Wie groß darf das Offline-Paket sein?**  
Ca. 500 Vokabeln + je 50 KB Audio ≈ 25 MB – kein Problem für moderne Handys.

**Warum HTTPS?**  
PWA und Offline-Cache funktionieren nur mit HTTPS (GitHub Pages liefert das automatisch).
