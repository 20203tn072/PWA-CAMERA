// ...existing code...
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
let currentFacing = 'environment'; // 'environment' or 'user'

// IndexedDB simple wrapper
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
    req.onsuccess = () => res(req.result.sort((a,b)=>b.ts-a.ts)); // newest first
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

// camera control functions
async function openCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Tu navegador no soporta acceso a la cámara.');
        return;
    }
    try {
        const constraints = {
            video: {
                facingMode: { exact: currentFacing } // try exact first
            },
            audio: false
        };
        // try exact facingMode, fallback if fails
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (err) {
          // fallback to ideal
          const c2 = { video: { facingMode: { ideal: currentFacing } }, audio:false };
          stream = await navigator.mediaDevices.getUserMedia(c2);
        }

        video.srcObject = stream;
        // ensure canvas dimensions after metadata loaded
        video.addEventListener('loadedmetadata', () => {
          canvas.width = video.videoWidth || 1280;
          canvas.height = video.videoHeight || 720;
        }, { once: true });

        cameraContainer.style.display = 'block';
        cameraContainer.setAttribute('aria-hidden','false');
        openCameraBtn.disabled = true;
        switchCameraBtn.disabled = false;
        takePhotoBtn.disabled = false;
        closeCameraBtn.disabled = false;
    } catch (error) {
        console.error('Error al acceder a la cámara:', error);
        alert('No se pudo acceder a la cámara. Revisa permisos.');
    }
}

async function switchCamera() {
  // toggle facing mode
  currentFacing = (currentFacing === 'environment') ? 'user' : 'environment';
  // restart stream if open
  if (stream) {
    closeCamera();
    await openCamera();
  } else {
    // update button text if closed
    updateSwitchLabel();
  }
}

function updateSwitchLabel() {
  switchCameraBtn.textContent = currentFacing === 'environment' ? 'Usar frontal' : 'Usar trasera';
}

function takePhoto() {
    if (!stream) { alert('Primero abre la cámara'); return; }

    const ctx = canvas.getContext('2d');
    // adjust canvas to current video size
    canvas.width = video.videoWidth || canvas.width;
    canvas.height = video.videoHeight || canvas.height;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // compress to jpeg to save space
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const id = Date.now().toString();
    const photo = { id, dataUrl, ts: Date.now() };

    dbAdd(photo)
      .then(() => {
        renderGallery();
      })
      .catch(err => console.error('Error saving photo', err));
}

function closeCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    video.srcObject = null;
    cameraContainer.style.display = 'none';
    cameraContainer.setAttribute('aria-hidden','true');
    openCameraBtn.disabled = false;
    switchCameraBtn.disabled = true;
    takePhotoBtn.disabled = true;
    closeCameraBtn.disabled = true;
}

// gallery render
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
      // click image to open in new tab
      el.querySelector('img').addEventListener('click', () => {
        const w = window.open(p.dataUrl, '_blank');
        if (!w) alert('Permite popups para ver la imagen en grande');
      });
      // delete handler
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

// init
openCameraBtn.addEventListener('click', openCamera);
switchCameraBtn.addEventListener('click', switchCamera);
takePhotoBtn.addEventListener('click', takePhoto);
closeCameraBtn.addEventListener('click', closeCamera);

updateSwitchLabel();
renderGallery();

// cleanup on unload
window.addEventListener('beforeunload', () => {
  closeCamera();
});