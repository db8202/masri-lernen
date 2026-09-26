/** Kurze Hilfe – Details nur auf Nachfrage */

export const HELP = {
  welcome: `3 Schritte: Lernen → Karte tippen → 🔊`,

  audio: `Aussprache
1. Eigene Aufnahme
2. Paket-Link (online sofort) / eingebettet offline
3. Computer-Stimme

Kein Ton? Toast erklärt warum.
Besser: Paket laden → Aussprache einrichten → oder 🎙️ aufnehmen.`,

  offline: `Wörter → „Aussprache einrichten (einmal)“ (WLAN). Danach offline.`,

  excel: `Wörter → Excel → Vorlage → ausfüllen → hochladen.`,

  modes: `Karten · Auswahl`,

  profiles: `Oben rechts 👤 – getrennte Profile.`,

  playlists: `Listen: Name + Wörter wählen → auf Start antippen.`,

  pack: `Vokabel-Paket (~6300) unter Wörter. Danach „Aussprache einrichten“.`,
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
