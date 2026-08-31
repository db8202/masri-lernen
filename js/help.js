/** Einfache Hilfe-Texte für Nicht-Expertinnen */

export const HELP = {
  welcome: `Willkommen bei Masri Lernen!

So startest du in 3 Schritten:
1. Tippe unten auf „Jetzt lernen"
2. Tippe auf die Karte - Antwort anzeigen
3. „Gewusst" oder „Noch üben"

Mehr Erklärungen findest du im Tab „Hilfe".`,

  audio: `So funktionieren Sprachdateien

Die App sucht AUTOMATISCH nach Audio.

Wenn du „Brot" speicherst, sucht die App:
- audio/brot.mp3 (am einfachsten!)
- audio/l1.mp3 (Vokabel-ID)

Beim Abspielen (Button 🔊):
1. MP3-Datei (offizielle Aussprache)
2. Eigene Aufnahme (🎙️)
3. Computer-Stimme (Fallback)

Neue Vokabel + Audio - 3 Wege:
A) MP3 als brot.mp3 in den audio-Ordner legen
B) Beim Speichern „Audio hochladen"
C) Mehrere MP3s hochladen - App erkennt den Dateinamen`,

  offline: `Offline lernen

Einmal mit Internet:
1. App auf Startbildschirm installieren
2. Tab „Meine Wörter" → „Offline-Paket laden"
3. Fertig - auch ohne Internet lernen!`,

  excel: `Excel-Vokabeln

1. Tab „Meine Wörter" → „Excel-Vorlage" laden
2. In Excel ausfüllen
3. Datei in der App hochladen

Optional: Spalte audio_datei mit z.B. brot.mp3`,

  modes: `Lernmodi

Karteikarten - Karte umdrehen
Auswahl - 4 Antworten anklicken
Eingabe - Antwort eintippen`,

  profiles: `Profile

Oben rechts auf 👤 tippen - z.B. für dich und deine Tochter getrennt.`,

  playlists: `Eigene Listen

1. „+ Neue Liste" tippen
2. Name eingeben (z.B. Flughafen)
3. Wörter ankreuzen → Speichern
4. Auf Start die Liste antippen zum Lernen

Listen sind unabhängig von Kategorien!`,

  pack: `Gratis Vokabel-Paket

~6.300 ägyptische Wörter mit Lingualism-Audio.
Die Begriffe sind auf Englisch — du kannst sie
in „Meine Wörter" auf Deutsch ändern.

Nach Import: „Offline-Paket laden" für Audio ohne Internet.`,
};

export function showHelpDialog(title, text) {
  const dlg = document.getElementById('help-dialog');
  if (!dlg) return;
  document.getElementById('help-dialog-title').textContent = title;
  document.getElementById('help-dialog-body').textContent = text;
  dlg.showModal();
}

export function maybeShowWelcome() {
  if (localStorage.getItem('masri_welcome_seen')) return;
  setTimeout(() => {
    showHelpDialog('Willkommen!', HELP.welcome);
    localStorage.setItem('masri_welcome_seen', '1');
  }, 800);
}
