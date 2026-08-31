# 🚀 Hosting abschließen – Schnellanleitung

**Ziel:** App unter `https://DEIN-NAME.github.io/masri-lernen/` erreichbar machen.

---

## Variante A: Automatisch (empfohlen, ~5 Min.)

1. Doppelklick auf **`deploy-github.bat`**
2. Bei GitHub anmelden (Browser öffnet sich)
3. Repository-Name bestätigen (Standard: `masri-lernen`)
4. GitHub → Repo → **Settings → Pages → Source: GitHub Actions**
5. Nach 1–2 Min. URL im Browser testen

---

## Variante B: Manuell ohne CLI

1. [github.com/signup](https://github.com/signup) – kostenloses Konto
2. **New repository** → Name `masri-lernen` → **Public** → Create
3. **Upload files** – alle Dateien aus diesem Ordner hochladen  
   **Nicht** hochladen: `node_modules/`
4. **Settings → Pages → Build and deployment → Source: GitHub Actions**
5. Unter **Actions** den Workflow „Deploy GitHub Pages" abwarten (grün ✓)

---

## Nach dem Deploy – Handy einrichten

1. **URL öffnen** (Safari auf iPhone, Chrome auf Android)
2. **App installieren**
   - Android: Menü → „App installieren" / „Zum Startbildschirm"
   - iPhone: Teilen ↗ → „Zum Home-Bildschirm"
3. **Tab „Meine Wörter"**
   - Optional: **Vokabel-Paket laden** (~6.300 Wörter + Audio)
   - **Offline-Paket laden** (einmalig mit WLAN)
4. **Flugmodus testen** ✈️

---

## Deine URL merken

```
https://DEIN-GITHUB-USERNAME.github.io/masri-lernen/
```

Als Lesezeichen speichern und per WhatsApp an die Familie schicken.

---

## Updates später hochladen

```powershell
cd "C:\Users\Dell Presicion Tower\aegyptisch-lernen"
git add -A
git commit -m "Update"
git push
```

GitHub Actions deployt automatisch neu (1–2 Min.).

---

## Checkliste Finalisierung

- [ ] GitHub Pages URL funktioniert (HTTPS)
- [ ] App auf Handy installiert
- [ ] Vokabel-Paket oder eigene Wörter importiert
- [ ] Offline-Paket geladen
- [ ] Flugmodus-Test bestanden
- [ ] Optional: MP3s in `audio/` Ordner → erneut pushen → Offline-Paket neu laden

---

## Hilfe bei Problemen

| Problem | Lösung |
|---------|--------|
| Seite leer / 404 | Pages Source = **GitHub Actions**, 2 Min. warten |
| PWA installiert nicht | Nur **HTTPS**-URL nutzen, nicht `file://` |
| Offline klappt nicht | Erst **Offline-Paket laden** mit Internet |
| Workflow rot | Repo → Actions → Fehlerlog lesen |

Ausführliche Anleitung: **`HOSTING-ANLEITUNG.md`**
