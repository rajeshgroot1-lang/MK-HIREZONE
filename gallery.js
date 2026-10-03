const GALLERY_DB_NAME = 'mkhz_company_gallery';
const GALLERY_STORE_NAME = 'images';
let galleryImageUrls = [];

function openGalleryDatabase(){
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(GALLERY_DB_NAME, 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore(GALLERY_STORE_NAME, { keyPath: 'id' });
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(new Error('Could not open gallery image storage.'));
  });
}

async function readGalleryImages(){
  const database = await openGalleryDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(GALLERY_STORE_NAME, 'readonly');
      const request = transaction.objectStore(GALLERY_STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error('Could not load gallery images.'));
      transaction.onabort = () => reject(new Error('Gallery image storage was interrupted.'));
    });
  } finally {
    database.close();
  }
}

async function renderCompanyGallery(){
  const gallery = document.getElementById('companyGallery');
  const message = document.getElementById('galleryMessage');
  galleryImageUrls.forEach(url => URL.revokeObjectURL(url));
  galleryImageUrls = [];
  message.textContent = '';
  try {
    const images = (await readGalleryImages()).sort((a, b) => String(b.uploadedAt || '').localeCompare(String(a.uploadedAt || '')));
    if (!images.length) {
      gallery.innerHTML = '<p class="company-gallery-empty">Company photos will appear here soon.</p>';
      return;
    }
    gallery.replaceChildren(...images.map(image => {
      const url = URL.createObjectURL(image.file);
      galleryImageUrls.push(url);
      const card = document.createElement('figure');
      card.className = 'public-gallery-card';
      const photo = document.createElement('img');
      photo.src = url;
      photo.alt = image.description || image.name;
      photo.loading = 'lazy';
      const imageButton = document.createElement('button');
      imageButton.className = 'gallery-image-button';
      imageButton.type = 'button';
      imageButton.setAttribute('aria-label', `View full-screen: ${image.name}`);
      imageButton.addEventListener('click', () => openGalleryImage(image, url));
      imageButton.append(photo);
      const caption = document.createElement('figcaption');
      caption.textContent = image.name;
      const description = document.createElement('p');
      description.className = 'public-gallery-description';
      description.textContent = image.description || '';
      card.append(imageButton, caption);
      if (image.description) card.append(description);
      return card;
    }));
  } catch (error) {
    gallery.replaceChildren();
    message.textContent = error.message;
    message.classList.add('error');
  }
}

function openGalleryImage(image, url){
  const viewer = document.getElementById('galleryViewer');
  document.getElementById('galleryViewerImage').src = url;
  document.getElementById('galleryViewerImage').alt = image.description || image.name;
  document.getElementById('galleryViewerName').textContent = image.name;
  document.getElementById('galleryViewerDescription').textContent = image.description || '';
  viewer.showModal();
}

document.getElementById('galleryViewerClose').addEventListener('click', () => {
  document.getElementById('galleryViewer').close();
});
document.addEventListener('keydown', event => {
  const viewer = document.getElementById('galleryViewer');
  if (event.key === 'Escape' && viewer.open) viewer.close();
});
document.addEventListener('DOMContentLoaded', renderCompanyGallery);
window.addEventListener('beforeunload', () => galleryImageUrls.forEach(url => URL.revokeObjectURL(url)));
