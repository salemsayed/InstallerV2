import { Workbox } from 'workbox-window';

// Check if service workers are supported
export const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      // Use the pre-created service worker in the public directory
      const workbox = new Workbox('/service-worker.js');

      // Add event listeners to handle updates
      workbox.addEventListener('installed', (event) => {
        if (event.isUpdate) {
          console.log('Service worker has been updated');
          // We'll use our update notification component instead of confirm
          // Dispatch event for the component to handle
          window.dispatchEvent(new CustomEvent('pwaUpdate'));
        } else {
          console.log('Service worker installed for the first time');
        }
      });

      workbox.addEventListener('waiting', () => {
        console.log('New service worker waiting to activate');
        // Dispatch event for update notification
        window.dispatchEvent(new CustomEvent('pwaUpdate'));
      });

      workbox.addEventListener('activated', (event) => {
        if (event.isUpdate) {
          console.log('Service worker activated after update');
        } else {
          console.log('Service worker activated for the first time');
        }
      });

      // Register the service worker
      await workbox.register();
      console.log('Service worker registered successfully');
      
      // Request persistent storage for PWA caches
      if (navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persist();
        console.log(`Persistent storage ${isPersisted ? 'granted' : 'denied'}`);
      }
      
      return true;
    } catch (error) {
      console.error('Service worker registration failed:', error);
      return false;
    }
  } else {
    console.log('Service workers are not supported in this browser');
    return false;
  }
};

// Check if the app is installed (PWA mode)
export const isPWAInstalled = () => {
  return window.matchMedia('(display-mode: standalone)').matches || 
         (window.navigator as any).standalone === true;
};

// Check if the app is running offline
export const isOffline = () => {
  return !navigator.onLine;
};

// Add a listener for network status changes
export const addOfflineListener = (callback: (offline: boolean) => void) => {
  window.addEventListener('online', () => callback(false));
  window.addEventListener('offline', () => callback(true));
  
  // Initial check
  callback(!navigator.onLine);
  
  return () => {
    window.removeEventListener('online', () => callback(false));
    window.removeEventListener('offline', () => callback(false));
  };
};

// Create standalone service worker file
export const createServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    const swCode = `
      // This is a simple service worker for PWA functionality
      
      // Cache names
      const STATIC_CACHE = 'static-cache-v1';
      const DYNAMIC_CACHE = 'dynamic-cache-v1';
      const API_CACHE = 'api-cache-v1';
      
      // Resources to cache on install
      const STATIC_ASSETS = [
        '/',
        '/index.html',
        '/offline.html',
        '/icons/offline-icon.svg',
        '/icons/icon-192x192.png',
        '/icons/icon-512x512.png',
        '/manifest.json'
      ];
      
      // Install event
      self.addEventListener('install', (event) => {
        console.log('[Service Worker] Installing Service Worker...');
        event.waitUntil(
          caches.open(STATIC_CACHE).then((cache) => {
            console.log('[Service Worker] Pre-caching App Shell');
            return cache.addAll(STATIC_ASSETS);
          })
        );
        self.skipWaiting();
      });
      
      // Activate event
      self.addEventListener('activate', (event) => {
        console.log('[Service Worker] Activating Service Worker...');
        event.waitUntil(
          caches.keys().then((keyList) => {
            return Promise.all(
              keyList.map((key) => {
                if (key !== STATIC_CACHE && key !== DYNAMIC_CACHE && key !== API_CACHE) {
                  console.log('[Service Worker] Removing old cache', key);
                  return caches.delete(key);
                }
              })
            );
          })
        );
        return self.clients.claim();
      });
      
      // Fetch event - handle offline functionality
      self.addEventListener('fetch', (event) => {
        const requestUrl = new URL(event.request.url);
        
        // Handle API requests - Network First strategy
        if (requestUrl.pathname.startsWith('/api/')) {
          // For scan-qr endpoint, use Background Sync if offline
          if (requestUrl.pathname === '/api/scan-qr' && event.request.method === 'POST') {
            if (!navigator.onLine) {
              event.respondWith(
                new Response(JSON.stringify({ 
                  offline: true, 
                  message: 'You are offline. This scan will be processed when you are back online.'
                }), {
                  headers: { 'Content-Type': 'application/json' }
                })
              );
              // Store for background sync
              event.waitUntil(
                (async () => {
                  try {
                    const cache = await caches.open('qr-scan-queue');
                    const clonedRequest = event.request.clone();
                    await cache.put('qr-scan-' + Date.now(), clonedRequest);
                  } catch (err) {
                    console.error('[Service Worker] Error queuing QR scan:', err);
                  }
                })()
              );
              return;
            }
          }
          
          // For all other API calls, use Network First strategy
          event.respondWith(
            fetch(event.request)
              .then((response) => {
                // Cache a clone of the response
                const responseClone = response.clone();
                caches.open(API_CACHE).then((cache) => {
                  cache.put(event.request, responseClone);
                });
                return response;
              })
              .catch(() => {
                // If network fails, try to get from cache
                return caches.match(event.request).then((cachedResponse) => {
                  if (cachedResponse) {
                    return cachedResponse;
                  }
                  // For navigation, serve the offline page
                  if (event.request.mode === 'navigate') {
                    return caches.match('/offline.html');
                  }
                  // Return empty JSON for API calls
                  if (requestUrl.pathname.startsWith('/api/')) {
                    return new Response(JSON.stringify({ offline: true }), {
                      headers: { 'Content-Type': 'application/json' }
                    });
                  }
                  // Return nothing for other requests
                  return new Response('Offline and not cached', { status: 408 });
                });
              })
          );
          return;
        }
        
        // For all other requests, use Cache First strategy
        event.respondWith(
          caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            
            return fetch(event.request)
              .then((response) => {
                // Don't cache responses that aren't successful
                if (!response || response.status !== 200 || response.type !== 'basic') {
                  return response;
                }
                
                // Cache the fetched response for future
                const responseToCache = response.clone();
                caches.open(DYNAMIC_CACHE).then((cache) => {
                  cache.put(event.request, responseToCache);
                });
                
                return response;
              })
              .catch(() => {
                // If the request is for a page navigation, return the offline page
                if (event.request.mode === 'navigate') {
                  return caches.match('/offline.html');
                }
                // Otherwise return nothing
                return new Response('Offline and not cached', { status: 408 });
              });
          })
        );
      });
      
      // Background sync for QR codes scanned while offline
      self.addEventListener('sync', (event) => {
        if (event.tag === 'sync-qr-scans') {
          event.waitUntil(
            caches.open('qr-scan-queue').then((cache) => {
              return cache.keys().then((keys) => {
                return Promise.all(
                  keys.map((key) => {
                    return cache.match(key).then((response) => {
                      if (!response) return;
                      
                      return fetch(response.clone()).then(() => {
                        return cache.delete(key);
                      }).catch((err) => {
                        console.error('[Service Worker] Error processing offline QR scan:', err);
                      });
                    });
                  })
                );
              });
            })
          );
        }
      });
      
      // Listen for messages from the client
      self.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SKIP_WAITING') {
          self.skipWaiting();
        }
      });
      
      // When back online, trigger a sync event
      self.addEventListener('online', () => {
        self.registration.sync.register('sync-qr-scans');
      });
    `;
    
    try {
      const blob = new Blob([swCode], { type: 'text/javascript' });
      const swUrl = URL.createObjectURL(blob);
      
      const registration = await navigator.serviceWorker.register(swUrl, { scope: '/' });
      console.log('Service worker registered:', registration);
      
      return true;
    } catch (error) {
      console.error('Service worker registration failed:', error);
      return false;
    }
  }
  
  return false;
};

// For dynamically registering the service worker
export const setupPWA = async () => {
  // Try the dynamic service worker creation first
  const dynamicRegistration = await createServiceWorker();
  
  if (!dynamicRegistration) {
    // Fall back to the standard registration
    return registerServiceWorker();
  }
  
  return dynamicRegistration;
};