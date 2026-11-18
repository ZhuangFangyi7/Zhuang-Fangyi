// =========================================================
// 1. IMPORT & KONFIGURASI FIREBASE + GITHUB STORAGE
// =========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

// GANTI DENGAN KONFIGURASI FIREBASE MILIKMU
const firebaseConfig = {
  apiKey: "AIzaSyA9_g3hu66hmiQaOY5DGGIhUpeJG_8kOhk",
  authDomain: "celestianworthy.firebaseapp.com",
  projectId: "celestianworthy",
  storageBucket: "celestianworthy.firebasestorage.app",
  messagingSenderId: "669221323067",
  appId: "1:669221323067:web:fcf6da7f8e46f0f805f71e"
};

// GANTI DENGAN UID AKUN ADMIN DARI FIREBASE AUTHENTICATION
const ADMIN_UID = [ "VgsLJvCk6DhMzM8vY1K7woMkUCu","i1TS3m5tUPMtDrIxdeKVrqvudYF3" ];

// GANTI DENGAN DATA REPOSITORY & TOKEN GITHUB MILIKMU
const GITHUB_CONFIG = {
  username: "ZhuangFangyi7", "CelestialWorthy0",
  repo: "portfolio-assets",
  branch: "main",
  token: "github_pat_11CVMRSGI0MJQckwNrNbnr" + "o9SFA9sOXXu63QANVvudhSosjtmoklgWwG8VNsca2gPXXYWU5WVehWCuZ1x";
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let isAdmin = false;

// =========================================================
// FUNGSI UPLOAD FILE & GAMBAR KE GITHUB STORAGE
// =========================================================
async function uploadToGitHub(file, folder = "uploads") {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Content = reader.result.split(',')[1];
        const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const filePath = `${folder}/${safeName}`;

        const apiUrl = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/${filePath}`;

        const response = await fetch(apiUrl, {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${GITHUB_CONFIG.token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            message: `Upload ${safeName}`,
            content: base64Content,
            branch: GITHUB_CONFIG.branch
          })
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.message || "Gagal mengunggah ke GitHub");
        }

        const rawUrl = `https://raw.githubusercontent.com/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/${GITHUB_CONFIG.branch}/${filePath}`;
        resolve(rawUrl);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

// =========================================================
// DATA BAWAAN & STATE PENYIMPANAN
// =========================================================
const DEFAULT_AVATAR = {
  image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
  zoom: 100,
  x: 0,
  y: 0,
  name: 'Zhuang Fangyi',
  role: 'Web Developer & Digital Creator'
};

const DEFAULT_WALLPAPER = {
  image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1600&q=80',
  opacity: 22,
  blur: 0,
  scale: 100,
  x: 50,
  y: 50,
  neonTint: true
};

const DEFAULT_PROFILE_TAB = {
  banner: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1400&q=80',
  avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80',
  name: 'Zhuang Fangyi',
  handle: '@zhuangfangyi',
  bio: 'Halo, saya Zhuang Fangyi. Saya mendalami pengembangan web interaktif, desain antarmuka modern, serta eksplorasi visual bergaya editorial.',
  location: 'Indonesia',
  status: 'Tersedia untuk Kolaborasi',
  skills: 'HTML • CSS • JavaScript • UI Design'
};

const DEFAULT_PROJECTS = [
  {
    id: 1,
    title: 'Konsep Editorial Hijau Neon',
    description: 'Eksplorasi tata letak bergaya sampul majalah modern dengan tipografi kontras tinggi dan aksen hijau neon.',
    image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80',
    fileName: 'konsep-desain.pdf',
    fileData: '#'
  },
  {
    id: 2,
    title: 'Catatan Pengembangan Antarmuka',
    description: 'Dokumentasi struktur komponen interaktif berbasis HTML, CSS, dan JavaScript murni tanpa framework berat.',
    image: null,
    fileName: null,
    fileData: null
  }
];

let projects = JSON.parse(localStorage.getItem('zf_neon_projects')) || DEFAULT_PROJECTS;
let avatarState = JSON.parse(localStorage.getItem('zf_neon_avatar')) || { ...DEFAULT_AVATAR };
let wallpaperState = JSON.parse(localStorage.getItem('zf_neon_wallpaper')) || { ...DEFAULT_WALLPAPER };
let profileTabState = JSON.parse(localStorage.getItem('zf_neon_profile_tab')) || { ...DEFAULT_PROFILE_TAB };

let editIndex = null;
let currentFilter = 'all';
let currentSearch = '';
let highlightMode = null;

// =========================================================
// NOTIFIKASI TOAST
// =========================================================
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2600);
}

// =========================================================
// SINKRONISASI CLOUD FIRESTORE (SIMPAN & MUAT)
// =========================================================
async function saveSettingsToCloud(docName, dataObj) {
  if (!isAdmin) return;
  try {
    await setDoc(doc(db, "portfolio_settings", docName), dataObj);
  } catch (err) {
    console.error("Gagal menyimpan ke Firebase:", err);
    showToast("Gagal sinkron ke Cloud: " + err.message);
  }
}

async function loadAllFromCloud() {
  try {
    const avSnap = await getDoc(doc(db, "portfolio_settings", "avatar"));
    if (avSnap.exists()) {
      avatarState = avSnap.data();
      localStorage.setItem('zf_neon_avatar', JSON.stringify(avatarState));
    }

    const wpSnap = await getDoc(doc(db, "portfolio_settings", "wallpaper"));
    if (wpSnap.exists()) {
      wallpaperState = wpSnap.data();
      localStorage.setItem('zf_neon_wallpaper', JSON.stringify(wallpaperState));
    }

    const profSnap = await getDoc(doc(db, "portfolio_settings", "profile_tab"));
    if (profSnap.exists()) {
      profileTabState = profSnap.data();
      localStorage.setItem('zf_neon_profile_tab', JSON.stringify(profileTabState));
    }

    const projSnap = await getDocs(collection(db, "portfolio_projects"));
    if (!projSnap.empty) {
      projects = [];
      projSnap.forEach((d) => projects.push(d.data()));
      projects.sort((a, b) => b.id - a.id);
      localStorage.setItem('zf_neon_projects', JSON.stringify(projects));
    }

    applyAvatarUI();
    applyWallpaperUI();
    applyProfileTabUI();
    renderProjects();
  } catch (err) {
    console.error("Gagal memuat data dari Firebase:", err);
  }
}

// =========================================================
// AUTENTIKASI OWNER / ADMIN
// =========================================================
onAuthStateChanged(auth, (user) => {
  if (user && ADMIN_UIDS.includes(user.uid)) {
    isAdmin = true;
    document.body.classList.add('is-admin');
    document.getElementById('auth-btn-label').textContent = 'Logout';
  } else {
    isAdmin = false;
    highlightMode = null;
    document.body.classList.remove('is-admin');
    document.getElementById('auth-btn-label').textContent = 'Login Admin';
  }
  renderProjects();
});

document.getElementById('btn-action-auth').addEventListener('click', async () => {
  if (isAdmin) {
    await signOut(auth);
    showToast('Berhasil logout dari mode admin.');
  } else {
    document.getElementById('login-modal').classList.add('open');
  }
});

document.getElementById('close-login-modal').addEventListener('click', () => {
  document.getElementById('login-modal').classList.remove('open');
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('admin-email').value.trim();
  const password = document.getElementById('admin-password').value;
  const btn = document.getElementById('login-submit-btn');

  btn.disabled = true;
  btn.textContent = 'Memeriksa...';

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    if (!ADMIN_UIDS.includes(cred.user.uid)) {
      await signOut(auth);
      throw new Error('Akun ini bukan pemilik (Admin) website.');
    }
    document.getElementById('login-modal').classList.remove('open');
    document.getElementById('login-form').reset();
    showToast('Selamat datang kembali, Admin!');
  } catch (err) {
    showToast('Login gagal: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Masuk';
  }
});

// =========================================================
// NAVIGASI TAB (BERANDA & PROJECT vs PROFIL PRIBADI)
// =========================================================
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));

    btn.classList.add('active');
    const targetId = btn.getAttribute('data-tab');
    document.getElementById(targetId).classList.add('active');
  });
});

// =========================================================
// PENERAPAN TAMPILAN AVATAR UTAMA & WALLPAPER
// =========================================================
function applyAvatarUI() {
  const img = document.getElementById('avatar-img');
  img.src = avatarState.image;
  img.style.transform = `scale(${avatarState.zoom / 100}) translate(${avatarState.x}px, ${avatarState.y}px)`;

  document.getElementById('display-name').textContent = avatarState.name;
  document.getElementById('display-role').textContent = avatarState.role;
  document.getElementById('header-creator-name').textContent = avatarState.name.toUpperCase();
}

function applyWallpaperUI(state = wallpaperState) {
  const layer = document.getElementById('wallpaper-layer');
  const tint = document.getElementById('wallpaper-tint');

  layer.style.backgroundImage = state.image ? `url('${state.image}')` : 'none';
  layer.style.opacity = state.opacity / 100;
  layer.style.filter = `blur(${state.blur}px)`;
  layer.style.backgroundPosition = `${state.x}% ${state.y}%`;
  layer.style.transform = `scale(${state.scale / 100})`;
  tint.style.display = state.neonTint ? 'block' : 'none';
}

// =========================================================
// RENDER DAFTAR PROJECT (FILTER & PENCARIAN)
// =========================================================
function renderProjects() {
  const container = document.getElementById('project-list');
  container.innerHTML = '';

  const filtered = projects.filter((p) => {
    const matchSearch =
      p.title.toLowerCase().includes(currentSearch) ||
      p.description.toLowerCase().includes(currentSearch);

    let matchType = true;
    if (currentFilter === 'image') matchType = Boolean(p.image);
    if (currentFilter === 'file') matchType = Boolean(p.fileName);
    if (currentFilter === 'text') matchType = !p.image && !p.fileName;

    return matchSearch && matchType;
  });

  const filterNames = {
    all: 'Semua Project',
    image: 'Project Bergambar',
    file: 'Project Dokumen',
    text: 'Catatan Teks'
  };
  document.getElementById('active-filter-label').textContent =
    `Menampilkan: ${filterNames[currentFilter]} (${filtered.length})`;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="project-card" style="grid-column: 1 / -1; text-align: center; padding: 36px;">
        <p style="margin: 0; color: var(--text-muted);">Tidak ada project yang sesuai dengan filter atau pencarian saat ini.</p>
      </div>
    `;
    return;
  }

  filtered.forEach((project) => {
    const realIndex = projects.findIndex((item) => item.id === project.id);

    let typeLabel = 'Teks';
    if (project.image && project.fileName) typeLabel = 'Gambar + Dokumen';
    else if (project.image) typeLabel = 'Gambar';
    else if (project.fileName) typeLabel = 'Dokumen';

    const card = document.createElement('article');
    card.className = 'project-card';
    if (isAdmin && highlightMode === 'edit') card.classList.add('mode-highlight-edit');
    if (isAdmin && highlightMode === 'delete') card.classList.add('mode-highlight-delete');

    const imgHTML = project.image
      ? `<img class="project-thumb" src="${project.image}" alt="${project.title}">`
      : '';

    const fileHTML = project.fileName
      ? `<a class="file-attachment" href="${project.fileData || '#'}" target="_blank" download="${project.fileName}">
           📎 ${project.fileName}
         </a>`
      : '';

    const adminButtonsHTML = isAdmin
      ? `<div class="card-footer-actions">
           <button type="button" class="btn-card btn-card-edit" data-edit-idx="${realIndex}">Edit</button>
           <button type="button" class="btn-card btn-card-del" data-del-idx="${realIndex}">Hapus</button>
         </div>`
      : '';

    card.innerHTML = `
      <div>
        <span class="card-type-badge">${typeLabel}</span>
        ${imgHTML}
        <h4>${project.title}</h4>
        <p>${project.description}</p>
        ${fileHTML}
      </div>
      ${adminButtonsHTML}
    `;

    container.appendChild(card);
  });

  // Pasang event listener tombol edit & hapus pada kartu (hanya saat admin)
  if (isAdmin) {
    container.querySelectorAll('.btn-card-edit').forEach((btn) => {
      btn.addEventListener('click', () => {
        openEditProject(Number(btn.getAttribute('data-edit-idx')));
      });
    });
    container.querySelectorAll('.btn-card-del').forEach((btn) => {
      btn.addEventListener('click', () => {
        deleteProject(Number(btn.getAttribute('data-del-idx')));
      });
    });
  }
}

// =========================================================
// MENU PENGATURAN LINGKARAN DI KIRI BAWAH
// =========================================================
const gearDock = document.getElementById('gear-dock');
const gearToggle = document.getElementById('gear-toggle');

gearToggle.addEventListener('click', () => {
  gearDock.classList.toggle('open');
  if (!gearDock.classList.contains('open')) {
    highlightMode = null;
    renderProjects();
  }
});

document.getElementById('btn-action-add').addEventListener('click', () => {
  if (!isAdmin) return;
  editIndex = null;
  document.getElementById('project-form').reset();
  document.getElementById('modal-form-title').textContent = 'Tambah Project Baru';
  document.getElementById('submit-btn').textContent = 'Tambah Project';
  document.getElementById('image-preview').innerHTML = '';
  document.getElementById('file-name').textContent = '';
  document.getElementById('project-modal').classList.add('open');
});

document.getElementById('btn-action-edit').addEventListener('click', () => {
  if (!isAdmin) return;
  if (projects.length === 0) {
    showToast('Belum ada project untuk diedit.');
    return;
  }
  highlightMode = highlightMode === 'edit' ? null : 'edit';
  renderProjects();
  document.getElementById('projects-area').scrollIntoView({ behavior: 'smooth' });
  showToast(
    highlightMode === 'edit'
      ? 'Mode Edit aktif: Klik tombol "Edit" pada kartu project yang diinginkan.'
      : 'Mode Edit dimatikan.'
  );
});

document.getElementById('btn-action-delete').addEventListener('click', () => {
  if (!isAdmin) return;
  if (projects.length === 0) {
    showToast('Tidak ada project untuk dihapus.');
    return;
  }
  highlightMode = highlightMode === 'delete' ? null : 'delete';
  renderProjects();
  document.getElementById('projects-area').scrollIntoView({ behavior: 'smooth' });
  showToast(
    highlightMode === 'delete'
      ? 'Mode Hapus aktif: Klik tombol "Hapus" pada kartu yang ingin dibuang.'
      : 'Mode Hapus dimatikan.'
  );
});

document.getElementById('btn-action-filter').addEventListener('click', () => {
  document.getElementById('panel-search').classList.remove('visible');
  document.getElementById('panel-filter').classList.toggle('visible');
});

document.getElementById('btn-action-search').addEventListener('click', () => {
  document.getElementById('panel-filter').classList.remove('visible');
  const searchPanel = document.getElementById('panel-search');
  searchPanel.classList.toggle('visible');
  if (searchPanel.classList.contains('visible')) {
    document.getElementById('search-input').focus();
  }
});

document.getElementById('btn-action-wallpaper').addEventListener('click', () => {
  if (isAdmin) openWallpaperModal();
});
document.getElementById('wp-quick-edit-btn').addEventListener('click', () => {
  if (isAdmin) openWallpaperModal();
});

document.querySelectorAll('.close-mini').forEach((btn) => {
  btn.addEventListener('click', () => {
    const targetId = btn.getAttribute('data-close');
    document.getElementById(targetId).classList.remove('visible');
  });
});

document.getElementById('search-input').addEventListener('input', (e) => {
  currentSearch = e.target.value.trim().toLowerCase();
  renderProjects();
});

document.querySelectorAll('.filter-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    currentFilter = chip.getAttribute('data-filter');
    renderProjects();
  });
});

// =========================================================
// CRUD PROJECT (TAMBAH, EDIT, HAPUS -> GITHUB + FIRESTORE)
// =========================================================
function openEditProject(index) {
  if (!isAdmin) return;
  editIndex = index;
  const project = projects[index];
  highlightMode = null;

  document.getElementById('modal-form-title').textContent = 'Edit Project';
  document.getElementById('submit-btn').textContent = 'Simpan Perubahan';
  document.getElementById('title').value = project.title;
  document.getElementById('description').value = project.description;

  document.getElementById('image-preview').innerHTML = project.image
    ? `<img src="${project.image}" alt="Preview">`
    : '';
  document.getElementById('file-name').textContent = project.fileName
    ? `File terlampir: ${project.fileName}`
    : '';

  document.getElementById('project-modal').classList.add('open');
}

async function deleteProject(index) {
  if (!isAdmin) return;
  if (confirm(`Yakin ingin menghapus project "${projects[index].title}"?`)) {
    const deletedId = String(projects[index].id);
    projects.splice(index, 1);
    localStorage.setItem('zf_neon_projects', JSON.stringify(projects));
    highlightMode = null;
    renderProjects();

    try {
      await deleteDoc(doc(db, "portfolio_projects", deletedId));
      showToast('Project berhasil dihapus dari Cloud.');
    } catch (err) {
      showToast('Gagal menghapus di Cloud: ' + err.message);
    }
  }
}

document.getElementById('image').addEventListener('change', function () {
  const preview = document.getElementById('image-preview');
  if (this.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
    };
    reader.readAsDataURL(this.files[0]);
  }
});

document.getElementById('file').addEventListener('change', function () {
  document.getElementById('file-name').textContent = this.files[0]
    ? `File dipilih: ${this.files[0].name}`
    : '';
});

document.getElementById('project-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  if (!isAdmin) return;

  const submitBtn = document.getElementById('submit-btn');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Mengunggah...';

  try {
    const title = document.getElementById('title').value.trim();
    const description = document.getElementById('description').value.trim();
    const imageInput = document.getElementById('image');
    const fileInput = document.getElementById('file');

    const existing = editIndex !== null ? projects[editIndex] : null;
    const projectData = {
      id: existing ? existing.id : Date.now(),
      title,
      description,
      image: existing ? existing.image : null,
      fileName: existing ? existing.fileName : null,
      fileData: existing ? existing.fileData : null
    };

    if (imageInput.files[0]) {
      projectData.image = await uploadToGitHub(imageInput.files[0], "images");
    }

    if (fileInput.files[0]) {
      const f = fileInput.files[0];
      projectData.fileName = f.name;
      projectData.fileData = await uploadToGitHub(f, "files");
    }

    if (editIndex !== null) {
      projects[editIndex] = projectData;
      showToast('Perubahan project disimpan ke Cloud!');
    } else {
      projects.unshift(projectData);
      showToast('Project baru berhasil ditambahkan ke Cloud!');
    }

    localStorage.setItem('zf_neon_projects', JSON.stringify(projects));
    await setDoc(doc(db, "portfolio_projects", String(projectData.id)), projectData);

    document.getElementById('project-modal').classList.remove('open');
    renderProjects();
  } catch (err) {
    console.error(err);
    showToast('Gagal menyimpan: ' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
});

document.getElementById('close-project-modal').addEventListener('click', () => {
  document.getElementById('project-modal').classList.remove('open');
});
document.getElementById('cancel-project-btn').addEventListener('click', () => {
  document.getElementById('project-modal').classList.remove('open');
});

// =========================================================
// EDITOR AVATAR UTAMA HALAMAN WEB (TERPISAH DARI PROFIL BIO)
// =========================================================
let tempAvatar = { ...avatarState };

function openAvatarModal() {
  if (!isAdmin) return;
  tempAvatar = { ...avatarState };
  const preview = document.getElementById('avatar-modal-preview');
  preview.src = tempAvatar.image;
  preview.style.transform = `scale(${tempAvatar.zoom / 100}) translate(${tempAvatar.x}px, ${tempAvatar.y}px)`;

  document.getElementById('avatar-url-input').value = tempAvatar.image.startsWith('data:') ? '' : tempAvatar.image;
  document.getElementById('av-zoom').value = tempAvatar.zoom;
  document.getElementById('av-x').value = tempAvatar.x;
  document.getElementById('av-y').value = tempAvatar.y;
  document.getElementById('val-av-zoom').textContent = `${tempAvatar.zoom}%`;
  document.getElementById('val-av-x').textContent = `${tempAvatar.x}px`;
  document.getElementById('val-av-y').textContent = `${tempAvatar.y}px`;
  document.getElementById('input-display-name').value = tempAvatar.name;
  document.getElementById('input-display-role').value = tempAvatar.role;

  document.getElementById('avatar-modal').classList.add('open');
}

document.getElementById('avatar-trigger').addEventListener('click', openAvatarModal);
document.getElementById('open-avatar-modal').addEventListener('click', openAvatarModal);

function updateAvatarPreviewTransform() {
  const preview = document.getElementById('avatar-modal-preview');
  preview.src = tempAvatar.image;
  preview.style.transform = `scale(${tempAvatar.zoom / 100}) translate(${tempAvatar.x}px, ${tempAvatar.y}px)`;
}

document.getElementById('avatar-file-input').addEventListener('change', async function () {
  if (this.files[0]) {
    showToast('Mengunggah avatar ke GitHub...');
    try {
      const url = await uploadToGitHub(this.files[0], "avatars");
      tempAvatar.image = url;
      updateAvatarPreviewTransform();
      showToast('Avatar siap disimpan!');
    } catch (err) {
      showToast('Gagal upload avatar: ' + err.message);
    }
  }
});

document.getElementById('avatar-url-input').addEventListener('input', function () {
  if (this.value.trim()) {
    tempAvatar.image = this.value.trim();
    updateAvatarPreviewTransform();
  }
});

['av-zoom', 'av-x', 'av-y'].forEach((id) => {
  document.getElementById(id).addEventListener('input', function () {
    const val = Number(this.value);
    if (id === 'av-zoom') {
      tempAvatar.zoom = val;
      document.getElementById('val-av-zoom').textContent = `${val}%`;
    } else if (id === 'av-x') {
      tempAvatar.x = val;
      document.getElementById('val-av-x').textContent = `${val}px`;
    } else {
      tempAvatar.y = val;
      document.getElementById('val-av-y').textContent = `${val}px`;
    }
    updateAvatarPreviewTransform();
  });
});

document.getElementById('avatar-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!isAdmin) return;
  tempAvatar.name = document.getElementById('input-display-name').value.trim() || DEFAULT_AVATAR.name;
  tempAvatar.role = document.getElementById('input-display-role').value.trim() || DEFAULT_AVATAR.role;

  avatarState = { ...tempAvatar };
  localStorage.setItem('zf_neon_avatar', JSON.stringify(avatarState));
  applyAvatarUI();
  await saveSettingsToCloud("avatar", avatarState);
  document.getElementById('avatar-modal').classList.remove('open');
  showToast('Avatar utama beranda berhasil diperbarui!');
});

document.getElementById('reset-avatar-btn').addEventListener('click', async () => {
  if (!isAdmin) return;
  avatarState = { ...DEFAULT_AVATAR };
  localStorage.setItem('zf_neon_avatar', JSON.stringify(avatarState));
  applyAvatarUI();
  await saveSettingsToCloud("avatar", avatarState);
  document.getElementById('avatar-modal').classList.remove('open');
  showToast('Avatar utama dikembalikan ke bawaan.');
});

document.getElementById('close-avatar-modal').addEventListener('click', () => {
  document.getElementById('avatar-modal').classList.remove('open');
});

// =========================================================
// EDITOR WALLPAPER INTERAKTIF
// =========================================================
let tempWallpaper = { ...wallpaperState };

function openWallpaperModal() {
  if (!isAdmin) return;
  tempWallpaper = { ...wallpaperState };

  document.getElementById('wp-url-input').value = tempWallpaper.image.startsWith('data:') ? '' : tempWallpaper.image;
  document.getElementById('wp-opacity').value = tempWallpaper.opacity;
  document.getElementById('wp-blur').value = tempWallpaper.blur;
  document.getElementById('wp-scale').value = tempWallpaper.scale;
  document.getElementById('wp-x').value = tempWallpaper.x;
  document.getElementById('wp-y').value = tempWallpaper.y;
  document.getElementById('wp-neon-tint').checked = tempWallpaper.neonTint;

  document.getElementById('val-wp-opacity').textContent = `${tempWallpaper.opacity}%`;
  document.getElementById('val-wp-blur').textContent = `${tempWallpaper.blur}px`;
  document.getElementById('val-wp-scale').textContent = `${tempWallpaper.scale}%`;
  document.getElementById('val-wp-x').textContent = `${tempWallpaper.x}%`;
  document.getElementById('val-wp-y').textContent = `${tempWallpaper.y}%`;

  document.getElementById('wallpaper-modal').classList.add('open');
}

document.getElementById('wp-file-input').addEventListener('change', async function () {
  if (this.files[0]) {
    showToast('Mengunggah wallpaper ke GitHub...');
    try {
      const url = await uploadToGitHub(this.files[0], "wallpapers");
      tempWallpaper.image = url;
      applyWallpaperUI(tempWallpaper);
      showToast('Wallpaper siap disimpan!');
    } catch (err) {
      showToast('Gagal upload wallpaper: ' + err.message);
    }
  }
});

document.getElementById('wp-url-input').addEventListener('input', function () {
  if (this.value.trim()) {
    tempWallpaper.image = this.value.trim();
    applyWallpaperUI(tempWallpaper);
  }
});

['wp-opacity', 'wp-blur', 'wp-scale', 'wp-x', 'wp-y'].forEach((id) => {
  document.getElementById(id).addEventListener('input', function () {
    const val = Number(this.value);
    if (id === 'wp-opacity') {
      tempWallpaper.opacity = val;
      document.getElementById('val-wp-opacity').textContent = `${val}%`;
    } else if (id === 'wp-blur') {
      tempWallpaper.blur = val;
      document.getElementById('val-wp-blur').textContent = `${val}px`;
    } else if (id === 'wp-scale') {
      tempWallpaper.scale = val;
      document.getElementById('val-wp-scale').textContent = `${val}%`;
    } else if (id === 'wp-x') {
      tempWallpaper.x = val;
      document.getElementById('val-wp-x').textContent = `${val}%`;
    } else if (id === 'wp-y') {
      tempWallpaper.y = val;
      document.getElementById('val-wp-y').textContent = `${val}%`;
    }
    applyWallpaperUI(tempWallpaper);
  });
});

document.getElementById('wp-neon-tint').addEventListener('change', function () {
  tempWallpaper.neonTint = this.checked;
  applyWallpaperUI(tempWallpaper);
});

document.getElementById('wallpaper-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!isAdmin) return;
  wallpaperState = { ...tempWallpaper };
  localStorage.setItem('zf_neon_wallpaper', JSON.stringify(wallpaperState));
  applyWallpaperUI(wallpaperState);
  await saveSettingsToCloud("wallpaper", wallpaperState);
  document.getElementById('wallpaper-modal').classList.remove('open');
  showToast('Wallpaper latar berhasil disimpan!');
});

document.getElementById('reset-wallpaper-btn').addEventListener('click', async () => {
  if (!isAdmin) return;
  wallpaperState = { ...DEFAULT_WALLPAPER };
  localStorage.setItem('zf_neon_wallpaper', JSON.stringify(wallpaperState));
  applyWallpaperUI(wallpaperState);
  await saveSettingsToCloud("wallpaper", wallpaperState);
  document.getElementById('wallpaper-modal').classList.remove('open');
  showToast('Wallpaper dikembalikan ke bawaan.');
});

document.getElementById('close-wallpaper-modal').addEventListener('click', () => {
  applyWallpaperUI(wallpaperState);
  document.getElementById('wallpaper-modal').classList.remove('open');
});

// =========================================================
// EDITOR PROFIL PRIBADI TERPISAH (BANNER LANDSCAPE + AVATAR PROFIL + BIO)
// =========================================================
let tempProfileTab = { ...profileTabState };

function applyProfileTabUI() {
  document.getElementById('profile-banner-img').src = profileTabState.banner;
  document.getElementById('profile-avatar-img').src = profileTabState.avatar;
  document.getElementById('prof-name').textContent = profileTabState.name;
  document.getElementById('prof-handle').textContent = profileTabState.handle;
  document.getElementById('prof-bio').textContent = profileTabState.bio;
  document.getElementById('prof-location').textContent = profileTabState.location;
  document.getElementById('prof-status').textContent = profileTabState.status;
  document.getElementById('prof-skills').textContent = profileTabState.skills;
}

function openProfileEditorModal() {
  if (!isAdmin) return;
  tempProfileTab = { ...profileTabState };

  document.getElementById('prof-banner-url').value = tempProfileTab.banner.startsWith('data:') ? '' : tempProfileTab.banner;
  document.getElementById('prof-avatar-url').value = tempProfileTab.avatar.startsWith('data:') ? '' : tempProfileTab.avatar;
  document.getElementById('input-prof-name').value = tempProfileTab.name;
  document.getElementById('input-prof-handle').value = tempProfileTab.handle;
  document.getElementById('input-prof-bio').value = tempProfileTab.bio;
  document.getElementById('input-prof-location').value = tempProfileTab.location;
  document.getElementById('input-prof-status').value = tempProfileTab.status;
  document.getElementById('input-prof-skills').value = tempProfileTab.skills;

  document.getElementById('profile-editor-modal').classList.add('open');
}

document.getElementById('open-profile-editor').addEventListener('click', openProfileEditorModal);
document.getElementById('profile-avatar-trigger').addEventListener('click', openProfileEditorModal);

document.getElementById('close-profile-editor').addEventListener('click', () => {
  document.getElementById('profile-editor-modal').classList.remove('open');
});

document.getElementById('prof-banner-file').addEventListener('change', async function () {
  if (this.files[0]) {
    showToast('Mengunggah banner ke GitHub...');
    try {
      tempProfileTab.banner = await uploadToGitHub(this.files[0], "banners");
      showToast('Banner siap disimpan!');
    } catch (err) {
      showToast('Gagal upload banner: ' + err.message);
    }
  }
});

document.getElementById('prof-banner-url').addEventListener('input', function () {
  if (this.value.trim()) tempProfileTab.banner = this.value.trim();
});

document.getElementById('prof-avatar-file').addEventListener('change', async function () {
  if (this.files[0]) {
    showToast('Mengunggah avatar profil ke GitHub...');
    try {
      tempProfileTab.avatar = await uploadToGitHub(this.files[0], "profile-avatars");
      showToast('Avatar profil siap disimpan!');
    } catch (err) {
      showToast('Gagal upload avatar profil: ' + err.message);
    }
  }
});

document.getElementById('prof-avatar-url').addEventListener('input', function () {
  if (this.value.trim()) tempProfileTab.avatar = this.value.trim();
});

document.getElementById('profile-editor-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!isAdmin) return;
  tempProfileTab.name = document.getElementById('input-prof-name').value.trim() || DEFAULT_PROFILE_TAB.name;
  tempProfileTab.handle = document.getElementById('input-prof-handle').value.trim() || DEFAULT_PROFILE_TAB.handle;
  tempProfileTab.bio = document.getElementById('input-prof-bio').value.trim() || DEFAULT_PROFILE_TAB.bio;
  tempProfileTab.location = document.getElementById('input-prof-location').value.trim() || DEFAULT_PROFILE_TAB.location;
  tempProfileTab.status = document.getElementById('input-prof-status').value.trim() || DEFAULT_PROFILE_TAB.status;
  tempProfileTab.skills = document.getElementById('input-prof-skills').value.trim() || DEFAULT_PROFILE_TAB.skills;

  profileTabState = { ...tempProfileTab };
  localStorage.setItem('zf_neon_profile_tab', JSON.stringify(profileTabState));
  applyProfileTabUI();
  await saveSettingsToCloud("profile_tab", profileTabState);
  document.getElementById('profile-editor-modal').classList.remove('open');
  showToast('Profil pribadi, avatar profil & banner berhasil diperbarui!');
});

document.getElementById('reset-profile-btn').addEventListener('click', async () => {
  if (!isAdmin) return;
  profileTabState = { ...DEFAULT_PROFILE_TAB };
  localStorage.setItem('zf_neon_profile_tab', JSON.stringify(profileTabState));
  applyProfileTabUI();
  await saveSettingsToCloud("profile_tab", profileTabState);
  document.getElementById('profile-editor-modal').classList.remove('open');
  showToast('Profil pribadi dikembalikan ke bawaan.');
});

// =========================================================
// PERLINDUNGAN AVATAR & BANNER DARI TAHAN / KLIK KANAN / DRAG
// =========================================================
const protectedSelectors = [
  '#avatar-img',
  '#avatar-trigger',
  '#profile-avatar-img',
  '#profile-avatar-trigger',
  '#profile-banner-img'
];

protectedSelectors.forEach((selector) => {
  const el = document.querySelector(selector);
  if (!el) return;

  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
  });

  el.addEventListener('dragstart', (e) => {
    e.preventDefault();
    return false;
  });

  el.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });
});

// =========================================================
// INISIALISASI SAAT HALAMAN DIMUAT
// =========================================================
applyAvatarUI();
applyWallpaperUI();
applyProfileTabUI();
renderProjects();
loadAllFromCloud();
