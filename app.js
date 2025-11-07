// Registro SW (relativo)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(function (registration) {
            console.log('Service Worker registrado con éxito:', registration);
        })
        .catch(function (error) {
            console.error('Error al registrar el Service Worker:', error);
        });
}

// DOM refs
const openCameraBtn = document.getElementById('openCamera');
const switchCameraBtn = document.getElementById('switchCamera');
const cameraContainer = document.getElementById('cameraContainer');
const video = document.getElementById('video');
const takePhotoBtn = document.getElementById('takePhoto');
const closeCameraBtn = document.getElementById('closeCamera');
const canvas = document.getElementById('canvas');
const gallery = document.getElementById('gallery');

let stream = null;
// Default: usar cámara frontal al abrir la app
let currentFacing = 'user'; // 'user' = frontal, 'environment' = trasera

/* IndexedDB simple wrapper */
const IDB_NAME = 'pwa_camera_db';
const IDB_STORE = 'photos';
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}
async function dbAdd(photo) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(photo);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
async function dbGetAll() {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).getAll();
    req.onsuccess = () => res(req.result.sort((a,b)=>b.ts-a.ts));
    req.onerror = () => rej(req.error);
  });
}
async function dbDelete(id) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const req = tx.objectStore(IDB_STORE).delete(id);
    req.onsuccess = () => res();
    req.onerror = () => rej(req.error);
  });
}

/* UI state helpers */
function setInitialUI() {
  // Sólo mostrar botón Abrir cámara al inicio
  openCameraBtn.style.display = 'inline-block';
  openCameraBtn.textContent = 'Abrir cámara';
  switchCameraBtn.style.display = 'none';
  takePhotoBtn.style.display = 'none';
  closeCameraBtn.style.display = 'none';
  cameraContainer.style.display = 'none';
}
function setCameraOpenUI() {
  // cuando la cámara está abierta
  openCameraBtn.style.display = 'none';
  switchCameraBtn.style.display = 'inline-block';
  updateSwitchLabel();
  takePhotoBtn.style.display = 'inline-block';
  closeCameraBtn.style.display = 'inline-block';
  cameraContainer.style.display = 'block';
}

/* Camera logic */
async function openCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Tu navegador no soporta acceso a la cámara.');
        return;
    }
    try {
        // Prefer exact facingMode, fallback to ideal
        const constraintsExact = { video: { facingMode: { exact: currentFacing } }, audio: false };
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraintsExact);
        } catch {
          const constraintsIdeal = { video: { facingMode: { ideal: currentFacing } }, audio: false };
          stream = await navigator.mediaDevices.getUserMedia(constraintsIdeal);
        }

        video.srcObject = stream;
        video.play();

        video.addEventListener('loadedmetadata', () => {
          canvas.width = video.videoWidth || 1280;
          canvas.height = video.videoHeight || 720;
        }, { once: true });

        setCameraOpenUI();
    } catch (error) {
        console.error('Error al acceder a la cámara:', error);
        alert('No se pudo acceder a la cámara. Revisa permisos.');
    }
}

function updateSwitchLabel() {
  // Mostrar en el botón la cámara que se activará al presionar
  // Si actualmente frontal (user), mostrar "Cámara trasera"
  if (currentFacing === 'user') switchCameraBtn.textContent = 'Cámara trasera';
  else switchCameraBtn.textContent = 'Cámara frontal';
}

async function switchCamera() {
  // alternar facing mode y reiniciar stream si abierto
  currentFacing = (currentFacing === 'environment') ? 'user' : 'environment';
  updateSwitchLabel();
  if (stream) {
    await restartStream();
  }
}

async function restartStream() {
  closeTracks();
  try {
    // reopen with new facing
    await openCamera();
  } catch (err) {
    console.error('No se pudo cambiar cámara', err);
  }
}

function takePhoto() {
    if (!stream) { alert('Primero abre la cámara'); return; }

    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth || canvas.width;
    canvas.height = video.videoHeight || canvas.height;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const id = Date.now().toString();
    const photo = { id, dataUrl, ts: Date.now() };

    dbAdd(photo)
      .then(() => renderGallery())
      .catch(err => console.error('Error saving photo', err));
}

function closeTracks() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
}

function closeCamera() {
    closeTracks();
    video.srcObject = null;
    cameraContainer.style.display = 'none';
    setInitialUI();
}

/* Gallery rendering */
async function renderGallery() {
  try {
    const photos = await dbGetAll();
    gallery.innerHTML = '';
    if (!photos.length) {
      gallery.innerHTML = '<div style="color:#666">No hay fotos aún</div>';
      return;
    }
    photos.forEach(p => {
      const el = document.createElement('div');
      el.className = 'thumb';
      el.innerHTML = `
        <img src="${p.dataUrl}" alt="foto-${p.id}" />
        <button class="del" data-id="${p.id}" aria-label="Eliminar">✕</button>
      `;
      el.querySelector('img').addEventListener('click', () => {
        const win = window.open(p.dataUrl, '_blank');
        if (!win) alert('Permite popups para ver la imagen en grande');
      });
      el.querySelector('.del').addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = e.currentTarget.getAttribute('data-id');
        if (!confirm('Eliminar foto?')) return;
        await dbDelete(id);
        renderGallery();
      });
      gallery.appendChild(el);
    });
  } catch (err) {
    console.error('Error rendering gallery', err);
    gallery.innerHTML = '<div style="color:#c00">Error cargando galería</div>';
  }
}

/* Event listeners wiring */
openCameraBtn.addEventListener('click', () => {
  // abrir cámara (usa frontal por defecto)
  openCamera();
});
switchCameraBtn.addEventListener('click', switchCamera);
takePhotoBtn.addEventListener('click', takePhoto);
closeCameraBtn.addEventListener('click', closeCamera);

/* Init UI + gallery */
setInitialUI();
renderGallery();

/* Cleanup on unload */
window.addEventListener('beforeunload', () => {
  closeTracks();
});