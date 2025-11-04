// Service Worker para PWA
const CACHE_NAME = 'camara-pwa-v1'; // Nombre/versión del caché
const urlsToCache = [ // Lista de archivos a guardar en caché
    '/PWA-CAMERA/',
    '/PWA-CAMERA/index.html',
    '/PWA-CAMERA/app.js',
    '/PWA-CAMERA/manifest.json',
    '/PWA-CAMERA/imagenes/icons/192.png',
    '/PWA-CAMERA/imagenes/icons/512.png',
];

// Instalar Service Worker
self.addEventListener('install', function(event) {
    // 1. Usar event.waitUntil para asegurar que la instalación no termine hasta que el caché esté listo
    event.waitUntil(
        // 2. Abrir el caché con el nombre definido
        caches.open(CACHE_NAME)
            .then(function(cache) {
                console.log('Cache abierto');
                // 3. Agregar todos los archivos de urlsToCache al almacenamiento
                return cache.addAll(urlsToCache);
            })
    );
});


// Interceptar peticiones
self.addEventListener('fetch', function(event) {
    // Usar event.respondWith para controlar la respuesta
    event.respondWith(
        // 1. Intentar encontrar la solicitud en el caché
        caches.match(event.request)
            .then(function(response) {
                // 2. Si se encuentra una respuesta en caché (es decir, el archivo existe)
                if (response) {
                    return response; // Devolver la versión en caché
                }
                // 3. Si no está en caché, ir a la red
                return fetch(event.request);
            })
    );
});


// Activar Service Worker
self.addEventListener('activate', function(event) {
    event.waitUntil(
        // 1. Obtener todos los nombres de caché existentes
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                // 2. Mapear y filtrar los cachés que no coinciden con el nombre actual (CACHE_NAME)
                cacheNames.map(function(cacheName) {
                    if (cacheName !== CACHE_NAME) {
                        // 3. Eliminar los cachés obsoletos
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});