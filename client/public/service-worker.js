// Basic Service Worker for BAREEQ Rewards PWA

// Cache names
const STATIC_CACHE = 'static-cache-v1';
const DYNAMIC_CACHE = 'dynamic-cache-v1';
const API_CACHE = 'api-cache-v1';

// Resources to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/icons/offline-icon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/manifest.json'
];

// Install event - cache core assets
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  
  // Skip waiting to ensure the new service worker activates immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');
  
  // Claim clients to ensure the service worker takes control immediately
  event.waitUntil(self.clients.claim());
  
  // Clean up old cache versions
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (
            cacheName !== STATIC_CACHE &&
            cacheName !== DYNAMIC_CACHE &&
            cacheName !== API_CACHE
          ) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event - handle network requests
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  
  // Handle API requests
  if (requestUrl.pathname.startsWith('/api/')) {
    // For QR scans, handle specially with background sync when offline
    if (requestUrl.pathname === '/api/scan-qr' && event.request.method === 'POST') {
      if (!navigator.onLine) {
        event.respondWith(
          new Response(
            JSON.stringify({
              offline: true,
              message: 'أنت غير متصل بالإنترنت. سيتم معالجة هذا المسح عندما تعود للاتصال.'
            }),
            {
              headers: { 'Content-Type': 'application/json' }
            }
          )
        );
        
        // Store for background sync
        event.waitUntil(
          (async () => {
            try {
              const cache = await caches.open('qr-scan-queue');
              const timestamp = Date.now();
              const clonedRequest = event.request.clone();
              
              await cache.put(`qr-scan-${timestamp}`, clonedRequest);
              console.log('[Service Worker] QR scan queued for sync:', timestamp);
            } catch (err) {
              console.error('[Service Worker] Error queuing QR scan:', err);
            }
          })()
        );
        
        return;
      }
    }
    
    // For other API calls, try network first, then cache
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Clone the response before using it
          const responseToCache = response.clone();
          
          // Cache the response for future use
          caches.open(API_CACHE).then(cache => {
            cache.put(event.request, responseToCache);
          });
          
          return response;
        })
        .catch(() => {
          // If network fails, try to get from cache
          return caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            
            // Return empty JSON for API calls
            if (requestUrl.pathname.startsWith('/api/')) {
              return new Response(
                JSON.stringify({ offline: true, cachedData: null }),
                { headers: { 'Content-Type': 'application/json' } }
              );
            }
          });
        })
    );
    
    return;
  }
  
  // For page navigations
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // Return offline page if navigation fails
          return caches.match('/offline.html');
        })
    );
    
    return;
  }
  
  // For all other requests, try cache first
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // If not in cache, fetch from network and cache
        return fetch(event.request)
          .then(response => {
            // Don't cache non-successful responses or non-GET requests
            if (
              !response ||
              response.status !== 200 ||
              response.type !== 'basic' ||
              event.request.method !== 'GET'
            ) {
              return response;
            }
            
            // Clone the response to cache it
            const responseToCache = response.clone();
            
            caches.open(DYNAMIC_CACHE)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(error => {
            console.error('[Service Worker] Fetch error:', error);
            
            // For image requests, return a fallback image
            if (event.request.destination === 'image') {
              return caches.match('/icons/offline-icon.svg');
            }
            
            // For other failures, return a simple error response
            return new Response('Network error', { status: 408 });
          });
      })
  );
});

// Background sync for offline operations
self.addEventListener('sync', event => {
  if (event.tag === 'sync-qr-scans') {
    console.log('[Service Worker] Syncing queued QR scans');
    
    event.waitUntil(
      caches.open('qr-scan-queue').then(cache => {
        return cache.keys().then(keys => {
          return Promise.all(
            keys.map(key => {
              // Process each queued scan
              return cache.match(key).then(async response => {
                if (!response) return;
                
                try {
                  // Try to send the scan to the server
                  const request = await response.clone();
                  await fetch(request);
                  
                  // If successful, remove from queue
                  await cache.delete(key);
                  console.log('[Service Worker] Successfully synced:', key.url);
                } catch (err) {
                  console.error('[Service Worker] Error syncing:', key.url, err);
                  // Keep it in the queue for next attempt
                }
              });
            })
          );
        });
      })
    );
  }
});

// When back online, trigger sync
self.addEventListener('online', () => {
  self.registration.sync.register('sync-qr-scans');
});

// Listen for messages from clients
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});