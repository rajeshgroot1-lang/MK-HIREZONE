const SESSION_KEY = 'mkhz_portal_user';
const UPLOAD_DB_NAME = 'mkhz_portal_uploads';
const UPLOAD_STORE_NAME = 'files';
const STORAGE_KEYS = {
  users: 'mkhz_portal_users',
  jobs: 'mkhz_portal_jobs',
  applications: 'mkhz_portal_applications',
  requests: 'mkhz_portal_client_requests'
};
const accessView = document.getElementById('accessView');
const accountView = document.getElementById('accountView');
const portalMessage = document.getElementById('portalMessage');
let currentUser = null;
let availableJobs = [];
let selectedJobId = null;
let profilePhotoUrl = '';
let profileResumeUrl = '';

const starterJobs = [
  { id: 'job-production-operator', title: 'Production Operator', department: 'Manufacturing', location: 'Krishnagiri', employmentType: 'Full-Time', experience: '1-3 years', salary: '₹18,000 - ₹30,000', description: 'Support production processes and maintain quality and safety standards across shifts.', qualifications: 'ITI / Diploma / SSLC', responsibilities: ['Operate assigned machines', 'Track output and quality', 'Maintain cleanliness and safety'] },
  { id: 'job-warehouse-associate', title: 'Warehouse Associate', department: 'Logistics', location: 'Bengaluru', employmentType: 'Full-Time', experience: '0-2 years', salary: '₹20,000 - ₹25,000', description: 'Manage goods movement, dispatch preparation and inventory documentation with speed and accuracy.', qualifications: 'Graduate / Diploma', responsibilities: ['Stock checking', 'Dispatch planning', 'Inventory management'] },
  { id: 'job-recruitment-executive', title: 'Recruitment Executive', department: 'HR', location: 'Chennai', employmentType: 'Full-Time', experience: '2-4 years', salary: '₹25,000 - ₹40,000', description: 'Source candidates, screen applications and coordinate hiring activities for growing teams.', qualifications: 'MBA / BBA / HR background', responsibilities: ['Candidate sourcing', 'Screening and scheduling', 'Vendor coordination'] }
];

function readStore(key, fallback = []) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStore(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password, saltHex) {
  if (!crypto.subtle) throw new Error('Password hashing requires a secure HTTPS site.');
  const salt = saltHex ? Uint8Array.from(saltHex.match(/.{2}/g), (byte) => parseInt(byte, 16)) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, key, 256);
  return { salt: bytesToHex(salt), hash: bytesToHex(new Uint8Array(bits)) };
}

function getJobs() {
  const jobs = readStore(STORAGE_KEYS.jobs, null);
  if (jobs) return jobs.filter((job) => job.isActive !== false);
  writeStore(STORAGE_KEYS.jobs, starterJobs);
  return starterJobs;
}

function openUploadDatabase() {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(UPLOAD_DB_NAME, 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore(UPLOAD_STORE_NAME, { keyPath: 'id' });
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(new Error('Could not open browser file storage.'));
  });
}

async function saveUpload(id, file) {
  if (!file) return;
  const database = await openUploadDatabase();
  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(UPLOAD_STORE_NAME, 'readwrite');
      transaction.objectStore(UPLOAD_STORE_NAME).put({ id, file, name: file.name, type: file.type });
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(new Error('Could not save the uploaded file.'));
      transaction.onabort = () => reject(new Error('File storage was interrupted.'));
    });
  } finally {
    database.close();
  }
}

async function getUpload(id) {
  if (!id) return null;
  const database = await openUploadDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(UPLOAD_STORE_NAME, 'readonly');
      const request = transaction.objectStore(UPLOAD_STORE_NAME).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Could not read the uploaded file.'));
    });
  } finally {
    database.close();
  }
}

function clearProfileFileUrls() {
  if (profilePhotoUrl) URL.revokeObjectURL(profilePhotoUrl);
  if (profileResumeUrl) URL.revokeObjectURL(profileResumeUrl);
  profilePhotoUrl = '';
  profileResumeUrl = '';
}

async function renderProfileFiles(user) {
  clearProfileFileUrls();
  const container = document.getElementById('profileDocuments');
  const photo = document.getElementById('profilePhoto');
  const resume = document.getElementById('profileResume');
  photo.hidden = true;
  resume.hidden = true;

  const [photoFile, resumeFile] = await Promise.all([getUpload(user.photoId), getUpload(user.resumeId)]);
  if (photoFile) {
    profilePhotoUrl = URL.createObjectURL(photoFile.file);
    photo.src = profilePhotoUrl;
    photo.hidden = false;
  }
  if (resumeFile) {
    profileResumeUrl = URL.createObjectURL(resumeFile.file);
    resume.href = profileResumeUrl;
    resume.download = resumeFile.name;
    resume.textContent = `Download resume: ${resumeFile.name}`;
    resume.hidden = false;
  }
  container.hidden = !photoFile && !resumeFile;
}

function showMessage(message, isError = false) {
  portalMessage.textContent = message;
  portalMessage.classList.toggle('error', isError);
}

function showProfileMessage(message, isError = false, isSuccess = false) {
  const target = document.getElementById('profileMessage');
  target.replaceChildren();
  if (isSuccess) {
    const check = document.createElement('span');
    check.className = 'success-check';
    check.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.textContent = message;
    target.append(check, text);
  } else {
    target.textContent = message;
  }
  target.classList.toggle('error', isError);
  target.classList.toggle('profile-success', isSuccess);
}

function escapeText(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

function setBusy(form, busy, label) {
  const button = form.querySelector('button[type="submit"]');
  if (!button) return;
  if (busy) {
    button.dataset.originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = label;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalLabel || label;
  }
}

document.querySelectorAll('.portal-tab').forEach((button) => {
  button.addEventListener('click', () => {
    const isRegister = button.dataset.view === 'register';
    document.getElementById('loginForm').hidden = isRegister;
    document.getElementById('registerForm').hidden = !isRegister;
    document.querySelectorAll('.portal-tab').forEach((tab) => {
      const selected = tab === button;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', String(selected));
    });
    showMessage('');
  });
});

document.getElementById('registerForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const fields = Object.fromEntries(new FormData(form));
  setBusy(form, true, 'Creating account...');
  showMessage('');
  try {
    const users = readStore(STORAGE_KEYS.users);
    const username = fields.username.trim();
    const email = fields.email.trim().toLowerCase();
    const photoFile = form.elements.photo.files[0];
    const resumeFile = form.elements.resume.files[0];
    if (users.some((user) => user.username.toLowerCase() === username.toLowerCase())) throw new Error('That username is already registered.');
    if (users.some((user) => user.email === email)) throw new Error('That email is already registered.');
    if (photoFile && (!photoFile.type.startsWith('image/') || photoFile.size > 2 * 1024 * 1024)) throw new Error('Choose an image no larger than 2 MB for your photo.');
    if (resumeFile && (!['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(resumeFile.type) || resumeFile.size > 8 * 1024 * 1024)) throw new Error('Choose a PDF or Word resume no larger than 8 MB.');
    const password = await hashPassword(fields.password);
    const photoId = photoFile ? makeId() : null;
    const resumeId = resumeFile ? makeId() : null;
    await Promise.all([saveUpload(photoId, photoFile), saveUpload(resumeId, resumeFile)]);
    const user = {
      id: makeId(),
      username,
      name: fields.name.trim(),
      email,
      phone: fields.phone.trim(),
      role: fields.role,
      photoId,
      resumeId,
      passwordSalt: password.salt,
      passwordHash: password.hash
    };
    users.push(user);
    writeStore(STORAGE_KEYS.users, users);
    sessionStorage.setItem(SESSION_KEY, user.id);
    form.reset();
    await loadAccount();
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    setBusy(form, false, 'Create account');
  }
});

document.getElementById('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const fields = Object.fromEntries(new FormData(form));
  setBusy(form, true, 'Signing in...');
  showMessage('');
  try {
    const identifier = fields.username.trim().toLowerCase();
    const user = readStore(STORAGE_KEYS.users).find((candidate) =>
      candidate.username.toLowerCase() === identifier || candidate.email === identifier
    );
    if (!user || user.isActive === false) throw new Error('Username/email or password is incorrect, or this account is disabled.');
    const password = await hashPassword(fields.password, user.passwordSalt);
    if (password.hash !== user.passwordHash) throw new Error('Username/email or password is incorrect.');
    sessionStorage.setItem(SESSION_KEY, user.id);
    form.reset();
    await loadAccount();
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    setBusy(form, false, 'Login');
  }
});

document.getElementById('logoutButton').addEventListener('click', () => {
  sessionStorage.removeItem(SESSION_KEY);
  clearProfileFileUrls();
  currentUser = null;
  accountView.hidden = true;
  accessView.hidden = false;
  showMessage('You have been logged out.');
});

function populateProfileForm(user) {
  const form = document.getElementById('profileForm');
  const nameParts = String(user.name || '').trim().split(/\s+/).filter(Boolean);
  form.elements.firstName.value = user.firstName || nameParts.shift() || '';
  form.elements.lastName.value = user.lastName || nameParts.join(' ');
  form.elements.dateOfBirth.value = user.dateOfBirth || '';
  form.elements.phone.value = user.phone || '';
  form.elements.addressLine1.value = user.addressLine1 || user.permanentAddress || '';
  form.elements.addressLine2.value = user.addressLine2 || '';
  form.elements.city.value = user.city || '';
  form.elements.pinCode.value = user.pinCode || '';
  form.elements.dateOfBirth.max = new Date().toISOString().slice(0, 10);
}

function isProfileComplete(user) {
  return ['firstName', 'lastName', 'dateOfBirth', 'phone', 'addressLine1', 'addressLine2', 'city', 'pinCode']
    .every((field) => String(user[field] || '').trim());
}

function setProfileFormCollapsed(collapsed) {
  const section = document.getElementById('profileSection');
  const panel = document.getElementById('profileFormPanel');
  document.getElementById('profileCompletionBadge').hidden = !collapsed;
  section.classList.toggle('is-collapsed', collapsed);
  panel.setAttribute('aria-hidden', String(collapsed));
  panel.inert = collapsed;
}

document.getElementById('profileForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const fields = Object.fromEntries(new FormData(form));
  const fileFields = [
    { field: 'profilePhoto', key: 'photoId', maxSize: 2 * 1024 * 1024, accepts: (file) => file.type.startsWith('image/') },
    { field: 'aadhaarCard', key: 'aadhaarCardId', maxSize: 5 * 1024 * 1024 },
    { field: 'addressProof', key: 'addressProofId', maxSize: 5 * 1024 * 1024 },
    { field: 'panCard', key: 'panCardId', maxSize: 5 * 1024 * 1024 }
  ];
  const selectedFiles = fileFields.map((item) => ({ ...item, file: form.elements[item.field].files[0] })).filter((item) => item.file);
  setBusy(form, true, 'Saving profile...');
  showProfileMessage('');
  try {
    for (const item of selectedFiles) {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      if ((item.accepts && !item.accepts(item.file)) || (!item.accepts && !allowedTypes.includes(item.file.type))) {
        throw new Error(`Choose a supported file for ${item.field}.`);
      }
      if (item.file.size > item.maxSize) throw new Error(`${item.field} exceeds its file size limit.`);
    }

    const users = readStore(STORAGE_KEYS.users);
    const user = users.find((candidate) => candidate.id === currentUser.id);
    if (!user) throw new Error('Your account could not be found. Please sign in again.');
    for (const item of selectedFiles) {
      item.id = user[item.key] || makeId();
      await saveUpload(item.id, item.file);
      user[item.key] = item.id;
    }

    user.firstName = fields.firstName.trim();
    user.lastName = fields.lastName.trim();
    user.name = `${user.firstName} ${user.lastName}`;
    user.dateOfBirth = fields.dateOfBirth;
    user.phone = fields.phone.trim();
    user.addressLine1 = fields.addressLine1.trim();
    user.addressLine2 = fields.addressLine2.trim();
    user.city = fields.city.trim();
    user.pinCode = fields.pinCode.trim();
    user.permanentAddress = [user.addressLine1, user.addressLine2, user.city, user.pinCode].join(', ');
    user.documents = {
      ...(user.documents || {}),
      aadhaarCardId: user.aadhaarCardId || null,
      addressProofId: user.addressProofId || null,
      panCardId: user.panCardId || null
    };
    writeStore(STORAGE_KEYS.users, users);
    currentUser = user;
    document.getElementById('accountName').textContent = user.name;
    document.getElementById('clientArea').hidden = user.role !== 'CLIENT';
    document.getElementById('applicantArea').hidden = user.role === 'CLIENT';
    await renderProfileFiles(user);
    form.querySelectorAll('input[type="file"]').forEach((input) => { input.value = ''; });
    showProfileMessage('Profile saved. You can now access your portal.', false, true);
    setProfileFormCollapsed(true);
    const nextSection = user.role === 'CLIENT' ? document.getElementById('clientArea') : document.getElementById('applicantArea');
    nextSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    showProfileMessage(error.message, true);
  } finally {
    setBusy(form, false, 'Save profile');
  }
});

async function loadAccount() {
  const userId = sessionStorage.getItem(SESSION_KEY);
  const user = readStore(STORAGE_KEYS.users).find((candidate) => candidate.id === userId);
  if (!user || user.isActive === false) {
    sessionStorage.removeItem(SESSION_KEY);
    accountView.hidden = true;
    accessView.hidden = false;
    return;
  }

  currentUser = user;
  accessView.hidden = true;
  accountView.hidden = false;
  document.getElementById('accountName').textContent = user.name || user.username;
  document.getElementById('accountEmail').textContent = user.email;
  populateProfileForm(user);
  try {
    await renderProfileFiles(user);
  } catch (error) {
    showMessage(error.message, true);
  }

  const isClient = user.role === 'CLIENT';
  const profileComplete = isProfileComplete(user);
  setProfileFormCollapsed(profileComplete);
  document.getElementById('accountRole').textContent = isClient ? 'CLIENT ACCOUNT' : 'APPLICANT ACCOUNT';
  document.getElementById('clientArea').hidden = !isClient || !profileComplete;
  document.getElementById('applicantArea').hidden = isClient || !profileComplete;
  if (!profileComplete) showProfileMessage('Complete the required personal details and save to access your portal.');

  if (isClient) loadClientRequests();
  else {
    loadJobs();
    loadApplications();
  }
}

async function loadJobs() {
  const jobs = getJobs();
  availableJobs = jobs;
  selectedJobId = jobs[0]?.id || null;
  const target = document.getElementById('jobList');
  if (!jobs.length) {
    target.innerHTML = '<p class="portal-empty">No open jobs are available right now.</p>';
    renderJobDetails();
    return;
  }
  target.innerHTML = jobs.map((job) => `
    <article class="job-row">
      <button class="job-select${job.id === selectedJobId ? ' selected' : ''}" type="button" data-job-select="${escapeText(job.id)}" aria-pressed="${job.id === selectedJobId}">
        <span class="job-select-title">${escapeText(job.title)}</span>
        <span class="job-select-meta">${escapeText(job.department)} · ${escapeText(job.location)}</span>
      </button>
    </article>`).join('');
  renderJobDetails();
}

document.getElementById('jobList').addEventListener('click', (event) => {
  const button = event.target.closest('[data-job-select]');
  if (!button) return;
  selectedJobId = button.dataset.jobSelect;
  document.querySelectorAll('[data-job-select]').forEach((item) => {
    const selected = item.dataset.jobSelect === selectedJobId;
    item.classList.toggle('selected', selected);
    item.setAttribute('aria-pressed', String(selected));
  });
  renderJobDetails();
});

document.getElementById('jobList').addEventListener('keydown', (event) => {
  if (!['ArrowDown', 'ArrowUp', 'Escape'].includes(event.key)) return;
  if (event.key === 'Escape') {
    selectedJobId = null;
    document.querySelectorAll('[data-job-select]').forEach((item) => {
      item.classList.remove('selected');
      item.setAttribute('aria-pressed', 'false');
    });
    renderJobDetails();
    return;
  }

  const buttons = [...document.querySelectorAll('[data-job-select]')];
  const currentIndex = buttons.indexOf(event.target.closest('[data-job-select]'));
  const nextIndex = Math.max(0, Math.min(buttons.length - 1, currentIndex + (event.key === 'ArrowDown' ? 1 : -1)));
  event.preventDefault();
  buttons[nextIndex]?.focus();
});

function renderJobDetails() {
  const target = document.getElementById('jobDetails');
  const job = availableJobs.find((item) => item.id === selectedJobId);
  if (!job) {
    target.innerHTML = '<p class="portal-empty">Select a job to view its details.</p>';
    return;
  }

  const responsibilities = Array.isArray(job.responsibilities) ? job.responsibilities : [];
  target.innerHTML = `
    <p class="portal-kicker">${escapeText(job.department)}</p>
    <h3>${escapeText(job.title)}</h3>
    <p class="job-detail-meta">${escapeText(job.location)} · ${escapeText(job.employmentType)}</p>
    <dl class="job-facts">
      <div><dt>Experience</dt><dd>${escapeText(job.experience || 'Not specified')}</dd></div>
      <div><dt>Salary</dt><dd>${escapeText(job.salary || 'Not specified')}</dd></div>
      <div><dt>Qualifications</dt><dd>${escapeText(job.qualifications || 'Not specified')}</dd></div>
    </dl>
    <p class="job-description">${escapeText(job.description)}</p>
    ${responsibilities.length ? `<ul class="job-responsibilities">${responsibilities.map((item) => `<li>${escapeText(item)}</li>`).join('')}</ul>` : ''}
    <form id="jobApplicationForm" class="job-application-form">
      <label for="applicationMessage">Application message</label>
      <textarea id="applicationMessage" name="coverLetter" rows="4" placeholder="Example: I have 2 years of production experience and can work rotating shifts."></textarea>
      <button class="btn" type="submit">Submit application</button>
    </form>`;
}

function renderApplicationSuccess() {
  const target = document.getElementById('jobSubmissionSuccess');
  target.innerHTML = `
    <div class="application-success" role="status" aria-live="polite">
      <span class="success-check" aria-hidden="true"></span>
      <h3>Application submitted successfully!</h3>
      <p>You can follow its status in My applications.</p>
      <div class="application-success-actions">
        <button class="btn" id="viewApplicationsButton" type="button">View my applications</button>
        <button class="btn portal-dashboard-return" id="returnApplicantDashboard" type="button">Return to applicant dashboard</button>
      </div>
    </div>`;
  target.hidden = false;
  document.getElementById('jobBrowser').hidden = true;
}

document.getElementById('applicantArea').addEventListener('click', (event) => {
  if (event.target.id === 'viewApplicationsButton') {
    document.getElementById('applicationList').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  if (event.target.id === 'returnApplicantDashboard') {
    document.getElementById('jobSubmissionSuccess').hidden = true;
    document.getElementById('jobBrowser').hidden = false;
    document.getElementById('applicantArea').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

document.getElementById('jobDetails').addEventListener('submit', (event) => {
  if (event.target.id !== 'jobApplicationForm') return;
  event.preventDefault();
  const form = event.target;
  const button = form.querySelector('button[type="submit"]');
  const jobId = selectedJobId;
  button.disabled = true;
  try {
    const applications = readStore(STORAGE_KEYS.applications);
    if (applications.some((application) => application.userId === currentUser.id && application.jobId === jobId)) {
      throw new Error('You have already applied for this job.');
    }
    applications.unshift({
      id: makeId(),
      userId: currentUser.id,
      jobId,
      coverLetter: new FormData(form).get('coverLetter').trim(),
      status: 'APPLIED',
      createdAt: new Date().toISOString()
    });
    writeStore(STORAGE_KEYS.applications, applications);
    loadApplications();
    renderApplicationSuccess();
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    if (button.isConnected) button.disabled = false;
  }
});

async function loadApplications() {
  const jobs = getJobs();
  const applications = readStore(STORAGE_KEYS.applications)
    .filter((application) => application.userId === currentUser.id)
    .map((application) => ({ ...application, job: jobs.find((job) => job.id === application.jobId) }))
    .filter((application) => application.job);
  const target = document.getElementById('applicationList');
  target.innerHTML = applications.length ? applications.map((application) => `
    <article class="portal-row">
      <div class="application-row-details"><h3>${escapeText(application.job.title)}</h3><p>${escapeText(application.job.department)} · ${escapeText(application.job.location)}</p>${application.status === 'APPROVED' ? '<p class="application-approved-message" role="status">Your application is approved. Our team will contact you soon.</p>' : ''}</div>
      <span class="status-pill status-${escapeText(application.status.toLowerCase())}">${escapeText(application.status.replaceAll('_', ' '))}</span>
    </article>`).join('') : '<p class="portal-empty">You have not applied for a job yet.</p>';
}

document.getElementById('clientRequestForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const fields = Object.fromEntries(new FormData(form));
  setBusy(form, true, 'Submitting request...');
  showMessage('');
  try {
    const requests = readStore(STORAGE_KEYS.requests);
    requests.unshift({
      id: makeId(),
      userId: currentUser.id,
      companyName: fields.companyName.trim(),
      rolesNeeded: fields.rolesNeeded.trim(),
      headcount: Number(fields.headcount),
      location: fields.location.trim(),
      details: fields.details.trim(),
      status: 'PENDING',
      createdAt: new Date().toISOString()
    });
    writeStore(STORAGE_KEYS.requests, requests);
    form.reset();
    showMessage('Staffing request sent for admin review.');
    loadClientRequests();
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    setBusy(form, false, 'Submit staffing request');
  }
});

async function loadClientRequests() {
  const requests = readStore(STORAGE_KEYS.requests).filter((item) => item.userId === currentUser.id);
  const target = document.getElementById('clientRequestList');
  target.innerHTML = requests.length ? requests.map((item) => `
    <article class="portal-row">
      <div><h3>${escapeText(item.companyName)} · ${escapeText(item.headcount)} people</h3>
        <p>${escapeText(item.rolesNeeded)} · ${escapeText(item.location)}</p>
      </div>
      <span class="status-pill status-${escapeText(item.status.toLowerCase())}">${escapeText(item.status)}</span>
    </article>`).join('') : '<p class="portal-empty">No staffing requests yet.</p>';
}

if (sessionStorage.getItem(SESSION_KEY)) loadAccount();