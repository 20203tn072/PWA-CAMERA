if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(function (registration) {
            console.log('Service Worker registrado con éxito:', registration);
        })
        .catch(function (error) {
            console.error('Error al registrar el Service Worker:', error);
        });
}

// Referencias a elementos del DOM
const openCameraBtn = document.getElementById('openCamera');
const cameraContainer = document.getElementById('cameraContainer');
const video = document.getElementById('video');
const takePhotoBtn = document.getElementById('takePhoto');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d'); // Contexto 2D para dibujar en el Canvas

let stream = null; // Variable para almacenar el MediaStream de la cámara


async function openCamera() {
    try {
        // 1. Definición de Restricciones (Constraints)
        const constraints = {
            video: {
                facingMode: { ideal: 'environment' }, // Solicita la cámara trasera
                width: { ideal: 320 },
                height: { ideal: 240 }
            }
        };

        // 2. Obtener el Stream de Medios
        stream = await navigator.mediaDevices.getUserMedia(constraints);

        // 3. Asignar el Stream al Elemento <video>
        video.srcObject = stream;

        // 4. Actualización de la UI
        cameraContainer.style.display = 'block';
        openCameraBtn.textContent = 'Cámara Abierta';
        openCameraBtn.disabled = true;

        console.log('Cámara abierta exitosamente');
    } catch (error) {
        console.error('Error al acceder a la cámara:', error);
        alert('No se pudo acceder a la cámara. Asegúrate de dar permisos.');
    }
}



function takePhoto() {
    if (!stream) {
        alert('Primero debes abrir la cámara');
        return;
    }

    // 1. Dibujar el Frame de Video en el Canvas
    // El método drawImage() es clave: toma el <video> como fuente.
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 2. Conversión a Data URL
    const imageDataURL = canvas.toDataURL('image/png');

    // 3. (Opcional) Visualización y Depuración
    console.log('Foto capturada en base64:', imageDataURL.length, 'caracteres');

    // 4. Cierre de la Cámara (Para liberar recursos)
    closeCamera();
}


function closeCamera() {
    if (stream) {
        // Detener todos los tracks del stream (video, audio, etc.)
        stream.getTracks().forEach(track => track.stop());
        stream = null; // Limpiar la referencia

        // Limpiar y ocultar UI
        video.srcObject = null;
        cameraContainer.style.display = 'none';

        // Restaurar el botón 'Abrir Cámara'
        openCameraBtn.textContent = 'Abrir Cámara';
        openCameraBtn.disabled = false;

        console.log('Cámara cerrada');
    }
}


// Event listeners para la interacción del usuario
openCameraBtn.addEventListener('click', openCamera);
takePhotoBtn.addEventListener('click', takePhoto);

// Limpiar stream cuando el usuario cierra o navega fuera de la página
window.addEventListener('beforeunload', () => {
    closeCamera();
});