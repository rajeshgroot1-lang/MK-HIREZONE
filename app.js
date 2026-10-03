
// ---------- MK HIRE ZONE Shared JS ----------
const NAV = `
<header class="topbar"><div class="wrap">
  <div>&#9742; 8438567188 | 8682070112 | 7200660652</div>
  <div>&#9993; mkhirezone@gmail.com</div>
</div></header>
<nav class="mainnav"><div class="wrap">
  <div class="logo">MK <span>HIRE</span> ZONE<small>MANPOWER SUPPLY | HR | RECRUITMENT | PAYROLL</small></div>
  <ul>
    <li><a href="index.html">Home</a></li>
    <li><a href="index.html#about">About</a></li>
    <li><a href="index.html#contact">Contact</a></li>
    <li><a href="services.html">Services</a></li>
    <li><a href="payroll.html">Payroll</a></li>
    <li><a href="gallery.html">Gallery</a></li>
    <li><a href="careers.html">Enquire / Apply</a></li>
    <li><a href="portal.html">Applicant / Client Portal</a></li>
    <li><a href="admin.html">Admin</a></li>
  </ul>
</div></nav>`;

const FOOT = `
<footer><div class="cols">
  <div><h4>MK HIRE ZONE</h4><p>Manpower Supply & HR Services. We bridge the gap between top-tier talent and growing organizations with end-to-end HR solutions.</p></div>
  <div><h4>Quick Links</h4>
    <a href="index.html">Home</a><a href="index.html#about">About</a><a href="index.html#contact">Contact</a><a href="services.html">Services</a>
    <a href="payroll.html">Payroll</a><a href="gallery.html">Gallery</a><a href="careers.html">Enquire / Apply</a><a href="portal.html">Applicant / Client Portal</a><a href="admin.html">Admin Login</a></div>
  <div><h4>Contact</h4>
    <p><a href="mailto:mkhirezone@gmail.com">mkhirezone@gmail.com</a></p>
    <p>146, Maharajakadai Road,<br>Old Pet, Krishnagiri - 635001<br>Tamil Nadu, India</p>
    <p>GSTIN: 33ACHFM8129K1ZX<br>Udyam: UDYAM-TN-11-0013876</p></div>
  <div><h4>Contact Persons</h4>
    <p>Arun Kumar K — Managing Director (M.Com)<br><a href="tel:+918438567188">8438567188</a></p>
    <p>Chandra Kumar K — MBA<br><a href="tel:+918682070112">8682070112</a></p>
    <p>Monish Prathap V — B.Sc<br><a href="tel:+917200660652">7200660652</a></p></div>
</div>
<div class="copy">&copy; MK Hire Zone — Empowering organizations with strategic HR solutions & exceptional talent.</div></footer>`;

document.addEventListener('DOMContentLoaded', () => {
  const h = document.querySelector('header, nav');
  document.body.insertAdjacentHTML('afterbegin', NAV);
  document.body.insertAdjacentHTML('beforeend', FOOT);
  // highlight active
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('nav.mainnav a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === page || (page === 'index.html' && href === `index.html${location.hash}` && ['#about', '#contact'].includes(location.hash))) a.classList.add('active');
  });
    function addPasswordVisibilityControls(root = document) {
      root.querySelectorAll('input[type="password"]').forEach((input) => {
        if (input.parentElement.classList.contains('password-field-control')) return;
        const wrapper = document.createElement('span');
        wrapper.className = 'password-field-control';
        input.parentNode.insertBefore(wrapper, input);
        wrapper.append(input);

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'password-toggle';
        button.textContent = 'Show';
        button.setAttribute('aria-label', 'Show password');
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => {
          const showPassword = input.type === 'password';
          input.type = showPassword ? 'text' : 'password';
          button.textContent = showPassword ? 'Hide' : 'Show';
          button.setAttribute('aria-label', `${showPassword ? 'Hide' : 'Show'} password`);
          button.setAttribute('aria-pressed', String(showPassword));
        });
        wrapper.append(button);
      });
    }
  
    addPasswordVisibilityControls();
    const passwordObserver = new MutationObserver(() => addPasswordVisibilityControls());
    passwordObserver.observe(document.body, { childList: true, subtree: true });
});

// ---------- SETTINGS (admin-editable, live) ----------
const DEFAULTS = {
  company: "MK Hire Zone",
  tagline: "MANPOWER SUPPLY | HR MANAGEMENT | RECRUITMENT | PAYROLL",
  phone: "8438567188, 8682070112, 7200660652",
  email: "mkhirezone@gmail.com",
  skills: {
    "Unskilled":     { rate: 800,  basic: 9000,  da: 3600, hra: 5400, pf: 13, esi: 3.25 },
    "Semi-Skilled":  { rate: 1000, basic: 11000, da: 4400, hra: 6600, pf: 13, esi: 3.25 },
    "Skilled":       { rate: 1400, basic: 15000, da: 6000, hra: 9000, pf: 13, esi: 3.25 }
  },
  attendance: { workingDays: 26, shifts: "General (9 hrs) / Shift (8 hrs x 3)", otRate: 1.5, lopRule: "Loss of Pay for absent days (gross / working days)" }
};

function deepMerge(base, incoming){
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [key, value] of Object.entries(incoming || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value) && value !== null && typeof out[key] === 'object' && out[key] !== null && !Array.isArray(out[key])) {
      out[key] = deepMerge(out[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function getSettings(){ 
  try {
    const saved = JSON.parse(localStorage.getItem('mkhz_settings'));
    return deepMerge(DEFAULTS, saved);
  }
  catch(e){ return DEFAULTS; }
}
function saveSettings(s){ localStorage.setItem('mkhz_settings', JSON.stringify(s)); }
function broadcast(){ window.dispatchEvent(new CustomEvent('mkhz:settings')); }

// ---------- ENQUIRIES ----------
function getEnquiries(){ try { return JSON.parse(localStorage.getItem('mkhz_enquiries')) || []; } catch(e){ return []; } }
function addEnquiry(e){ const l = getEnquiries(); l.unshift(Object.assign({date:new Date().toLocaleString()}, e)); localStorage.setItem('mkhz_enquiries', JSON.stringify(l)); }
function deleteEnquiry(i){ const l = getEnquiries(); l.splice(i,1); localStorage.setItem('mkhz_enquiries', JSON.stringify(l)); }

function getApplicants(){ try { return JSON.parse(localStorage.getItem('mkhz_applicants')) || []; } catch(e){ return []; } }
function addApplicant(a){ const l = getApplicants(); l.unshift(Object.assign({date:new Date().toLocaleString()}, a)); localStorage.setItem('mkhz_applicants', JSON.stringify(l)); }
function deleteApplicant(i){ const l = getApplicants(); l.splice(i,1); localStorage.setItem('mkhz_applicants', JSON.stringify(l)); }
function exportApplicantsCsv(){
  const rows = getApplicants();
  if (!rows.length) { alert('No applications to export yet.'); return; }
  const headers = ['date','type','name','phone','email','qualification','skill','exp','location','message','resumeName','photoName'];
  const csv = [headers.join(',')];
  rows.forEach(row => {
    const values = headers.map(key => {
      const value = row[key] ?? '';
      const escaped = String(value).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csv.push(values.join(','));
  });
  const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'mkhirezone_applicants.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
} 
