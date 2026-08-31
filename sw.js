const CACHE = 'masri-lernen-v5';
const ASSETS = [
  './', './index.html', './manifest.json', './css/styles.css',
  './js/app.js', './js/storage.js', './js/srs.js', './js/speech.js',
  './js/help.js', './js/import.js', './js/sync.js', './js/notifications.js', './js/quiz.js',
  './js/audio-files.js', './js/audio-recorder.js', './js/utils.js', './js/toast.js', './js/charts.js',
  './js/vocab-pack.js', './js/categories.js', './js/record-assistant.js',
  './data/vocabulary.json', './data/grammar.json', './data/vokabeln.csv',
  './data/vokabeln.xlsx', './data/egyptian-pack-sections.json', './icons/icon.svg', './js/xlsx.full.min.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const net = fetch(e.request).then((response) => {
        if (response?.status === 200 && e.request.url.startsWith(self.location.origin)) {
          caches.open(CACHE).then((c) => c.put(e.request, response.clone()));
        }
        return response;
      }).catch(() => cached);
      return cached || net;
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    if (list[0]) return list[0].focus();
    return clients.openWindow('./');
  }));
});

self.addEventListener('message', (e) => {
  if (e.data?.type === 'SCHEDULE_REMINDER') {
    // Reminder handled on app foreground; SW acknowledges
  }
});
