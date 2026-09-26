/** Kurze Hilfe – Details nur auf Nachfrage */

export const HELP = {
  welcome: `3 Schritte: Lernen → Karte tippen → 🔊
Nur Deutsch ↔ ägyptisches Arabisch (Masri) — kein Englisch.`,

  audio: `Aussprache
1. 🎙️ Eigene Aufnahme auf der Karte
2. MP3 / Link (falls hinterlegt)
3. Computer-Stimme (sonst Lautschrift)

Besser: 🎙️ Aufnahme auf der Karte.`,

  offline: `🎙️ Aufnahme auf der Karte speichert den Ton lokal (auch offline).`,

  excel: `Wörter → Excel → Vorlage (Deutsch + Masri) → ausfüllen → hochladen.`,

  modes: `Karten · Auswahl`,

  profiles: `Oben rechts 👤 – getrennte Profile.`,

  playlists: `Listen: Name + Wörter wählen → auf Start antippen.`,

  languages: `Nur Deutsch und Masri. Das frühere englische Gratis-Paket ist entfernt. Neue Wörter: manuell oder Excel.`,
};

export const ONBOARDING_STEPS = [
  { title: 'Lernen', body: 'Jetzt lernen' },
  { title: 'Karte', body: 'Tippen' },
  { title: 'Audio', body: '🔊' },
];

export function showHelpDialog(title, text) {
  const dlg = document.getElementById('help-dialog');
  if (!dlg) return;
  document.getElementById('help-dialog-title').textContent = title;
  document.getElementById('help-dialog-body').textContent = text;
  dlg.showModal();
}

export function maybeShowOnboarding() {
  if (localStorage.getItem('masri_onboarding_seen') || localStorage.getItem('masri_welcome_seen')) return;
  const dlg = document.getElementById('onboarding-dialog');
  if (!dlg) {
    setTimeout(() => {
      showHelpDialog('Masri Lernen', HELP.welcome);
      localStorage.setItem('masri_onboarding_seen', '1');
    }, 500);
    return;
  }
  setTimeout(() => dlg.showModal(), 400);
}

export function dismissOnboarding(permanent = true) {
  if (permanent) {
    localStorage.setItem('masri_onboarding_seen', '1');
    localStorage.setItem('masri_welcome_seen', '1');
  }
  document.getElementById('onboarding-dialog')?.close();
}

export function maybeShowWelcome() {
  maybeShowOnboarding();
}
