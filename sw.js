/* ============================================================
   NOVA Service Worker
   ------------------------------------------------------------
   Strategi:
   • Sidan själv (index.html): NETWORK FIRST — hämta alltid
     färskt från servern, fall tillbaka på cachen bara offline.
     Därför slår varje GitHub-upload igenom direkt, både i
     webbläsaren och i den installerade appen.
   • Statiska filer (bilder, ikoner): STALE-WHILE-REVALIDATE —
     visa cachad version direkt, uppdatera i bakgrunden.
   • Allt annat (Supabase, Google Fonts, API:er): rörs inte.
     Service workern hanterar bara GET inom den egna domänen.

   Höj VERSION vid ändringar i denna fil — gamla cachar rensas
   automatiskt vid aktivering.
   ============================================================ */
const VERSION = 'nova-v2';
const APP_SHELL = ['./'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION).then(c => c.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   // Supabase, fonter m.m. — rör ej

  // Navigering (själva sidan): network first
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put('./', copy));
          return res;
        })
        .catch(() => caches.match('./'))
    );
    return;
  }

  // Statiska filer: stale-while-revalidate
  e.respondWith(
    caches.match(req).then(cached => {
      const fresh = fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});

/* ============================================================
   PUSH — tar emot notiser även när appen är stängd
   ============================================================ */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data.json(); } catch (err) { /* tom payload */ }
  e.waitUntil(self.registration.showNotification(d.title || 'NOVA · 노바', {
    body: d.body || '',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    data: { url: d.url || './' }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      if (list.length) return list[0].focus();
      return clients.openWindow(url);
    })
  );
});
