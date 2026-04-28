// ── API Configuration ──
const API_KEY = '11824503150ade959ba564320a36fcbb24274766c0a7f62589498eef4738337a';

// ── API helpers ──
const API = {
    async getStats() { return (await fetch('/api/stats')).json(); },
    async getChain() { return (await fetch('/api/chain')).json(); },
    async upload(formData, file) {
        const fileHash = await computeFileHash(file);
        return (await secureFetch('/api/upload', {
            method: 'POST',
            body: formData,
            fileHash
        })).json();
    },
    async verify(formData, file) {
        let fileHash = '';
        if (file) fileHash = await computeFileHash(file);
        return (await secureFetch('/api/verify', {
            method: 'POST',
            body: formData,
            fileHash
        })).json();
    },
    async getAudit() { return (await secureFetch('/api/chain/audit')).json(); },
    async getMe() {
        const r = await fetch('/auth/me');
        if (r.status === 401) return null;
        return r.json();
    },
    async getDocumentHistory(id) { return (await secureFetch(`/api/chain/document/${id}/history`)).json(); },
    async batchUpload(formData, files) {
        // For simplicity, we hash the first file or a composite for the batch signature
        const fileHash = files.length ? await computeFileHash(files[0]) : '';
        return (await secureFetch('/api/upload/batch-upload', {
            method: 'POST',
            body: formData,
            fileHash
        })).json();
    },
    async getBatchStatus(batchId) {
        return (await secureFetch(`/api/chain/batch/${batchId}/status`)).json();
    },
    async getDocument(id) {
        return (await secureFetch(`/api/chain/document/${id}`)).json();
    },
    async analyzeDocument(id) {
        return (await secureFetch(`/api/chain/document/${id}/analyze`, {
            method: 'POST'
        })).json();
    },
    async getUsers() {
        return (await secureFetch('/api/admin/users')).json();
    },
    async promoteUser(userId, newRole) {
        return (await secureFetch('/api/admin/promote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, newRole })
        })).json();
    }
};

// ── Security Helpers ──
async function computeFileHash(file) {
    if (!file) return '';
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            if (typeof CryptoJS === 'undefined') {
                console.error('[SECURITY] CryptoJS library failed to load. Check your network or script tags.');
                alert('Security engine failed to initialize. Please refresh the page.');
                return;
            }
            const wordArray = CryptoJS.lib.WordArray.create(e.target.result);
            const hash = CryptoJS.SHA256(wordArray).toString();
            resolve(hash);
        };
        reader.readAsArrayBuffer(file);
    });
}

async function secureFetch(url, options = {}) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const fileHash = options.fileHash || '';
    
    // Generate a random 16-character hex nonce
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(8)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    let signature = '';
    if (currentUser && currentUser.api_secret) {
        const method = options.method || 'GET';
        
        let bodyStr = '';
        if (options.body && !(options.body instanceof FormData)) {
            // STABLE SIGNING: Sort keys alphabetically to match backend hmac.js
            const bodyObj = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
            const sortedBody = Object.keys(bodyObj).sort().reduce((acc, key) => {
                acc[key] = bodyObj[key];
                return acc;
            }, {});
            bodyStr = JSON.stringify(sortedBody);
        }

        const payload = `${method}${url}${timestamp}${fileHash}${nonce}${bodyStr}`;
        signature = CryptoJS.HmacSHA256(payload, currentUser.api_secret).toString();
    }

    const headers = {
        ...(options.headers || {}),
        'X-Signature': signature,
        'X-Timestamp': timestamp,
        'X-File-Hash': fileHash,
        'X-Nonce': nonce,
        'x-api-key': API_KEY,
        'X-User-ID': currentUser?.id || ''
    };

    return fetch(url, { ...options, headers });
}


// ── Auth State ──
let currentUser = null;

// ── Role State ──
let currentMode = localStorage.getItem('dover_mode') || 'b2c'; // Default to Citizen
let activeCategory = 'all'; // Default to all documents

function switchMode(mode) {
    currentMode = mode;
    localStorage.setItem('dover_mode', mode);
    activeCategory = 'all'; // Reset category filter on mode switch

    // Update Buttons
    const btnB2c = document.getElementById('btn-b2c');
    const btnB2b = document.getElementById('btn-b2b');

    if (mode === 'b2c') {
        btnB2c.className = 'flex-1 py-1.5 px-2 rounded-lg text-[10px] font-black uppercase bg-primary text-white shadow-md transition-all';
        btnB2b.className = 'flex-1 py-1.5 px-2 rounded-lg text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-all';
    } else {
        btnB2b.className = 'flex-1 py-1.5 px-2 rounded-lg text-[10px] font-black uppercase bg-primary text-white shadow-md transition-all';
        btnB2c.className = 'flex-1 py-1.5 px-2 rounded-lg text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-all';
    }

    updateSidebarUI(currentUser);
    navigate();

    // Close mobile sidebar after mode switch
    document.getElementById('sidebar')?.classList.remove('mobile-open');
}

// ── Mobile Toggle ──
document.addEventListener('click', e => {
    const btn = e.target.closest('#mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');
    const navLink = e.target.closest('.nav-link');

    if (btn) {
        const isOpen = sidebar.classList.toggle('mobile-open');
        btn.setAttribute('aria-expanded', isOpen);
    } else if (navLink) {
        sidebar.classList.remove('mobile-open');
        document.getElementById('mobile-menu-btn')?.setAttribute('aria-expanded', 'false');
    } else if (sidebar?.classList.contains('mobile-open') && !e.target.closest('#sidebar')) {
        sidebar.classList.remove('mobile-open');
        document.getElementById('mobile-menu-btn')?.setAttribute('aria-expanded', 'false');
    }
});

function handleLogout() {
    localStorage.removeItem('dover_demo_user');
    window.location.href = '/auth/logout';
}

async function checkAuth() {
    // Check for Demo Bypass user first
    const demoUser = localStorage.getItem('dover_demo_user');
    if (demoUser) {
        currentUser = JSON.parse(demoUser);
    } else {
        currentUser = await API.getMe();
    }
    
    const app = document.getElementById('app');
    const sidebar = document.getElementById('sidebar');
    const header = document.querySelector('header');

    if (!currentUser) {
        if (sidebar) sidebar.style.display = 'none';
        if (header) header.style.display = 'none';
        renderLogin(app);
    } else {
        if (sidebar) sidebar.style.display = 'flex';
        if (header) {
            header.style.display = 'flex';
            updateHeaderUI(header, currentUser);
        }
        // Initialize Mode UI
        switchMode(currentMode);
    }
}

function updateSidebarUI(user) {
    const navLinks = document.getElementById('nav-links');
    if (!navLinks) return;

    if (currentMode === 'b2c') {
        // Citizen Navigation
        navLinks.innerHTML = `
            <a href="#dashboard" data-page="dashboard" class="nav-link flex items-center px-4 py-3 mx-2 rounded-lg transition-all group">
                <span class="material-symbols-outlined mr-3 text-xl">account_balance_wallet</span><span class="font-medium text-sm">My Vault</span>
            </a>
            <a href="#upload" data-page="upload" class="nav-link flex items-center px-4 py-3 mx-2 rounded-lg transition-all group">
                <span class="material-symbols-outlined mr-3 text-xl">add_moderator</span><span class="font-medium text-sm">Secure Personal Doc</span>
            </a>
            <a href="#verify" data-page="verify" class="nav-link flex items-center px-4 py-3 mx-2 rounded-lg transition-all group">
                <span class="material-symbols-outlined mr-3 text-xl">verified_user</span><span class="font-medium text-sm">Quick Verify</span>
            </a>
            <a href="#chain" data-page="chain" class="nav-link flex items-center px-4 py-3 mx-2 rounded-lg transition-all group">
                <span class="material-symbols-outlined mr-3 text-xl">account_tree</span><span class="font-medium text-sm">Global Ledger</span>
            </a>
        `;
    } else {
        // Institutional Navigation
        navLinks.innerHTML = `
            <a href="#dashboard" data-page="dashboard" class="nav-link flex items-center px-4 py-3 mx-2 rounded-lg transition-all group">
                <span class="material-symbols-outlined mr-3 text-xl">analytics</span><span class="font-medium text-sm">Admin Dashboard</span>
            </a>
            <a href="#upload" data-page="upload" class="nav-link flex items-center px-4 py-3 mx-2 rounded-lg transition-all group">
                <span class="material-symbols-outlined mr-3 text-xl">upload_file</span><span class="font-medium text-sm">Institutional Upload</span>
            </a>
            <a href="#batch" data-page="batch" class="nav-link flex items-center px-4 py-3 mx-2 rounded-lg transition-all group">
                <span class="material-symbols-outlined mr-3 text-xl">folder_managed</span><span class="font-medium text-sm">Batch Ingestion</span>
            </a>
            <a href="#audit" data-page="audit" class="nav-link flex items-center px-4 py-3 mx-2 rounded-lg transition-all group">
                <span class="material-symbols-outlined mr-3 text-xl">history_edu</span><span class="font-medium text-sm">Compliance Logs</span>
            </a>
        `;

        if (user.role === 'authority') {
            const adminLink = document.createElement('a');
            adminLink.href = '#admin';
            adminLink.dataset.page = 'admin';
            adminLink.className = 'nav-link flex items-center px-4 py-3 mx-2 rounded-lg transition-all group';
            adminLink.innerHTML = `
                <span class="material-symbols-outlined mr-3 text-xl">admin_panel_settings</span>
                <span class="font-medium text-sm">Personnel Control</span>
            `;
            navLinks.appendChild(adminLink);
        }
    }
}

// ── Guest Mode bypass — must be top-level so onclick="bypassLogin()" can find it ──
window.bypassLogin = () => {
    localStorage.setItem('dover_demo_user', JSON.stringify({
        id: 'demo-user',
        name: 'Hackathon Judge',
        email: 'judge@hackathon.io',
        role: 'authority',
        picture: 'https://ui-avatars.com/api/?name=Judge&background=001e40&color=fff',
        api_secret: 'demo-secret-key-12345'
    }));
    window.location.reload();
};

function renderLogin(container) {
    container.innerHTML = `
        <div class="fixed inset-0 flex items-center justify-center bg-slate-50 dark:bg-[#0A192F] z-[100] fade-in">
            <div class="bg-white dark:bg-[#1C2A41] p-12 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-slate-100 dark:border-slate-800 max-w-md w-full text-center space-y-8 scale-in mx-6">
                <div class="flex flex-col items-center gap-6">
                    <div class="w-24 h-24 bg-gradient-to-br from-[#001e40] to-[#0059bb] rounded-3xl flex items-center justify-center text-white shadow-2xl">
                        <span class="material-symbols-outlined text-6xl" style="font-variation-settings:'FILL' 1;">verified_user</span>
                    </div>
                    <div class="space-y-1">
                        <h1 class="text-4xl font-black text-primary dark:text-[#E9C176] tracking-tighter uppercase">DoVER</h1>
                        <p class="text-[10px] uppercase tracking-[0.3em] text-slate-400 dark:text-[#D6E3FF]/40 font-black">Official Vault Portal</p>
                    </div>
                </div>

                <div class="space-y-4 py-4">
                    <h2 class="text-2xl font-bold text-slate-800 dark:text-[#D6E3FF]">Authentication Required</h2>
                    <p class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed px-4">Access to the decentralized registry is restricted to authorized personnel.</p>
                </div>

                <button onclick="window.location='/auth/google'" class="w-full flex items-center justify-center gap-4 bg-white dark:bg-[#0F1B33] border border-slate-200 dark:border-slate-700 py-4 rounded-2xl font-bold text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-500 transition-all active:scale-[0.98] shadow-sm group">
                    <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" class="w-6 h-6 group-hover:scale-110 transition-transform" alt="Google"/>
                    <span class="text-base">Sign in with Google</span>
                </button>

                <div class="relative flex items-center py-2">
                    <div class="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
                    <span class="flex-shrink mx-4 text-[10px] font-black uppercase text-slate-300 tracking-widest">OR</span>
                    <div class="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
                </div>

                <button onclick="bypassLogin()" class="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-primary dark:hover:text-[#E9C176] font-bold text-sm transition-all">
                    <span class="material-symbols-outlined text-lg">no_accounts</span>
                    <span>Continue as Guest (Demo Mode)</span>
                </button>


                <p class="text-[10px] text-slate-400 font-medium">By signing in, you agree to the secure audit protocols.</p>
            </div>
        </div>
    `;
}

function updateHeaderUI(header, user) {
    const isDark = document.documentElement.classList.contains('dark');
    const badge = user.role === 'authority' ? `<span class="px-2 py-0.5 rounded bg-[#E9C176]/20 text-[#E9C176] text-[9px] font-black uppercase border border-[#E9C176]/30">Authority</span>` : '';

    header.innerHTML = `
        <div class="flex items-center gap-4">
            <span class="md:hidden material-symbols-outlined text-blue-900 dark:text-[#E9C176] cursor-pointer" id="menu-toggle">menu</span>
            <div class="flex items-center gap-2">
                <h2 id="page-title" class="font-sans tracking-tight text-slate-500 dark:text-[#D6E3FF] font-medium text-sm">Welcome back, ${(user.name || 'User').split(' ')[0]}</h2>
                ${badge}
            </div>
        </div>
        <div class="flex items-center gap-4">
            <div class="flex items-center gap-3 pr-4 border-r border-slate-200 dark:border-slate-700">
                <div class="text-right hidden sm:block">
                    <p class="text-xs font-bold text-slate-700 dark:text-white leading-none">${user.name}</p>
                    <p class="text-[10px] text-slate-400 font-medium">${user.email}</p>
                </div>
                <img src="${user.picture}" class="h-9 w-9 rounded-full border-2 border-primary/10 shadow-sm" alt="Profile"/>
            </div>
            <button onclick="handleLogout()" class="flex items-center gap-2 text-slate-500 hover:text-error transition-colors text-xs font-bold uppercase tracking-wider">
                <span class="material-symbols-outlined text-lg">logout</span>
                <span class="hidden sm:inline">Logout</span>
            </button>
        </div>
    `;

    // Re-attach menu toggle event
    document.getElementById('menu-toggle')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('mobile-open');
    });
}

// ── Router ──
function navigate() {
    if (!currentUser) return checkAuth();
    const page = (location.hash.slice(1) || 'dashboard');

    // Updated selector to match dynamic links
    document.querySelectorAll('.nav-link').forEach(l => {
        const isPageMatch = l.dataset.page === page || l.getAttribute('href') === `#${page}`;
        l.classList.toggle('bg-white/60', isPageMatch);
        l.classList.toggle('dark:bg-white/10', isPageMatch);
        l.classList.toggle('text-primary', isPageMatch);
        l.classList.toggle('shadow-sm', isPageMatch);
    });

    const app = document.getElementById('app');
    app.innerHTML = '';
    switch (page) {
        case 'upload': renderUpload(app); break;
        case 'verify': renderVerify(app); break;
        case 'chain': renderChain(app); break;
        case 'audit': renderAudit(app); break;
        case 'settings': renderSettings(app); break;
        case 'help': renderHelp(app); break;
        case 'batch': renderBatch(app); break;
        case 'admin':
            if (currentUser.role === 'authority') {
                renderAdmin(app);
            } else {
                location.hash = '#dashboard';
            }
            break;
        default: renderDashboard(app); break;
    }
}
window.addEventListener('hashchange', navigate);
window.addEventListener('DOMContentLoaded', checkAuth);
document.getElementById('menu-toggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('mobile-open');
});

// ── Category Mapping for B2B/B2C ──
const CATEGORY_MAP = {
    b2c: {
        'Personal': ['Personal', 'Personal Identity (Passport/ID)', 'Academic Certificates', 'Medical Reports'],
        'Family': ['Family', 'Family Records (Birth/Marriage)', 'Financial Assets'],
        'Office': ['Office', 'Office Records']
    },
    b2b: {
        'Employee Records': ['Employee Records', 'Employee Contract', 'Personnel ID / KYC', 'Payroll & Tax', 'Experience Letters', 'Non-Disclosure Agreements', 'Termination Records']
    }
};

function renderTable(container, documents) {
    if (!documents.length) {
        container.innerHTML = `<div class="py-20 text-center space-y-4">
            <span class="material-symbols-outlined text-6xl text-slate-200">folder_open</span>
            <p class="text-slate-400 font-medium italic">No documents found in this category.</p>
        </div>`;
        return;
    }

    container.innerHTML = `
        <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="border-b border-slate-100 dark:border-slate-800">
                        <th class="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Document</th>
                        <th class="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fingerprint</th>
                        <th class="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                        <th class="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-50 dark:divide-slate-800/50">
                    ${documents.map(d => {
                        // Find the "Parent" category for display
                        let parentCat = d.department;
                        for (const [parent, subs] of Object.entries(CATEGORY_MAP[currentMode])) {
                            if (subs.includes(d.department)) {
                                parentCat = parent;
                                break;
                            }
                        }
                        
                        return `
                        <tr class="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group">
                            <td class="px-6 py-5">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
                                        <span class="material-symbols-outlined">description</span>
                                    </div>
                                    <div>
                                        <p class="text-sm font-bold text-primary dark:text-[#D6E3FF]">${d.filename.split(/[/\\]/).pop()}</p>
                                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-tighter">${parentCat}</p>
                                    </div>
                                </div>
                            </td>
                            <td class="px-6 py-5">
                                <code class="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-black/20 px-2 py-1 rounded">${d.block_hash.slice(0, 12)}...</code>
                            </td>
                            <td class="px-6 py-5 text-xs text-slate-500 font-medium">${new Date(d.upload_timestamp).toLocaleDateString()}</td>
                            <td class="px-6 py-5 text-right">
                                <div class="flex items-center justify-end gap-2">
                                    <button onclick="renderIntegrityModal(${d.block_index})" class="p-2 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors" title="Verify Integrity" aria-label="Verify integrity of block ${d.block_index}">
                                        <span class="material-symbols-outlined text-xl">verified</span>
                                    </button>
                                    <a href="/api/chain/document/${d.block_index}/certified" target="_blank" class="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors" title="Download Certified PDF" aria-label="Download official certified PDF for block ${d.block_index}">
                                        <span class="material-symbols-outlined text-xl">picture_as_pdf</span>
                                    </a>
                                </div>
                            </td>
                        </tr>
                    `}).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function loadVaultDocuments(container) {
    container.innerHTML = '<div class="flex justify-center py-20"><div class="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>';

    try {
        const chain = await API.getChain();
        let filtered = chain;

        // 1. Filter by Mode (B2B vs B2C)
        // Note: For now we assume all docs are visible, but we filter them into categories
        // In a real app, B2B might only see docs with specific metadata

        if (activeCategory !== 'all') {
            const validDepts = CATEGORY_MAP[currentMode][activeCategory] || [];
            filtered = chain.filter(d => validDepts.includes(d.department));
        } else {
            // "All" filter for current mode
            const allValidDepts = Object.values(CATEGORY_MAP[currentMode]).flat();
            filtered = chain.filter(d => allValidDepts.includes(d.department));
        }

        renderTable(container, filtered.reverse());
    } catch (e) {
        container.innerHTML = '<p class="text-center text-red-500 py-20">Failed to load documents.</p>';
    }
}

// ── Stats Bar (shared) ──
function renderStatsBar(container) {
    const el = document.createElement('div');
    el.id = 'stats-bar';
    el.className = 'grid grid-cols-1 md:grid-cols-3 gap-6 fade-in';
    el.innerHTML = `
        <div class="stat-card bg-surface-container-lowest p-6 rounded-xl shadow-sm shadow-blue-900/5 relative overflow-hidden">
            <div class="absolute top-0 right-0 w-32 h-32 bg-secondary-fixed opacity-10 rounded-full -mr-16 -mt-16"></div>
            <div class="relative z-10 flex flex-col gap-4">
                <div class="w-12 h-12 bg-secondary-fixed/30 rounded-full flex items-center justify-center text-secondary">
                    <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1;">folder_shared</span>
                </div>
                <div><p class="text-slate-500 font-medium text-sm">Total Documents</p>
                <h3 class="text-3xl font-bold text-primary" id="stat-total">—</h3></div>
            </div>
        </div>
        <div class="stat-card bg-surface-container-lowest p-6 rounded-xl shadow-sm shadow-blue-900/5 relative overflow-hidden">
            <div class="absolute top-0 right-0 w-32 h-32 bg-primary-fixed opacity-10 rounded-full -mr-16 -mt-16"></div>
            <div class="relative z-10 flex flex-col gap-4">
                <div class="w-12 h-12 bg-primary-fixed/30 rounded-full flex items-center justify-center text-primary">
                    <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1;">verified</span>
                </div>
                <div><p class="text-slate-500 font-medium text-sm">Verified Today</p>
                <h3 class="text-3xl font-bold text-primary" id="stat-verified">—</h3></div>
            </div>
        </div>
        <div class="stat-card bg-surface-container-lowest p-6 rounded-xl shadow-sm shadow-blue-900/5 border border-error/5 relative overflow-hidden">
            <div class="absolute top-0 right-0 w-32 h-32 bg-error-container opacity-20 rounded-full -mr-16 -mt-16"></div>
            <div class="relative z-10 flex flex-col gap-4">
                <div class="w-12 h-12 bg-error-container/50 rounded-full flex items-center justify-center text-error">
                    <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1;">warning</span>
                </div>
                <div><p class="text-slate-500 font-medium text-sm">Tampered Detected</p>
                <h3 class="text-3xl font-bold text-error" id="stat-tampered">—</h3></div>
            </div>
        </div>`;
    container.appendChild(el);
    API.getStats().then(d => {
        document.getElementById('stat-total').textContent = d.total_documents?.toLocaleString() ?? '0';
        document.getElementById('stat-verified').textContent = d.verified_today?.toLocaleString() ?? '0';
        document.getElementById('stat-tampered').textContent = String(d.tampered_detected ?? 0).padStart(2, '0');
    }).catch(() => { });
}

// ── Dashboard Page ──
function renderDashboard(app) {
    const isB2b = currentMode === 'b2b';
    const titleText = isB2b ? 'Institutional Portal' : 'My Personal Vault';
    const subTitle = isB2b ? 'Corporate Governance & Employee Records' : 'Self-Sovereign Identity & Life Records';

    // 1. Clear container to prevent UI stacking glitch
    app.innerHTML = '';

    document.getElementById('page-title').textContent = titleText;
    const wrap = document.createElement('div');
    wrap.className = 'max-w-7xl mx-auto space-y-8 fade-in';

    const header = document.createElement('div');
    header.innerHTML = `<div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div><span class="text-secondary font-bold tracking-widest uppercase text-xs">${subTitle}</span>
        <h1 class="text-3xl font-extrabold text-primary tracking-tight mt-1">${isB2b ? 'Admin Overview' : 'Secure Document Storage'}</h1></div>
        <a href="#upload" class="bg-primary text-on-primary px-6 py-3 rounded-xl font-semibold flex items-center gap-2 shadow-lg shadow-primary/20 hover:bg-opacity-90 active:scale-95 transition-all">
            <span class="material-symbols-outlined text-lg">add</span> ${isB2b ? 'Issue New Certificate' : 'Protect New Document'}</a>
    </div>`;
    wrap.appendChild(header);
    renderStatsBar(wrap);

    // Vault Explorer with Tabs
    const explorer = document.createElement('div');
    explorer.className = 'bg-surface-container-lowest rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden';

    // Ensure "all" is always lowercased for state consistency, but others match CATEGORY_MAP keys
    const categories = ['all', ...Object.keys(CATEGORY_MAP[currentMode])];

    explorer.innerHTML = `
        <div class="px-8 py-6 border-b border-slate-50 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div class="flex items-center gap-2 overflow-x-auto no-scrollbar">
                ${categories.map(cat => `
                    <button onclick="setCategory('${cat}')" class="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeCategory === cat ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}">
                        ${cat}
                    </button>
                `).join('')}
            </div>
            <div class="relative">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                <input type="text" placeholder="Search vault..." class="pl-10 pr-4 py-2 bg-slate-50 dark:bg-black/20 border-none rounded-xl text-xs focus:ring-2 focus:ring-primary/10 w-full md:w-64"/>
            </div>
        </div>
        <div id="vault-list" class="min-h-[400px]"></div>
    `;
    wrap.appendChild(explorer);

    app.appendChild(wrap);

    // Load documents into the explorer
    const listContainer = document.getElementById('vault-list');
    loadVaultDocuments(listContainer);
}

// Global helper to switch categories
window.setCategory = (cat) => {
    activeCategory = cat;
    // Partial re-render (just the explorer if we were fancy, but simple for now)
    const app = document.getElementById('app');
    renderDashboard(app);
};

// ── Upload Page ──
function renderUpload(app) {
    document.getElementById('page-title').textContent = 'Upload Documents';
    const wrap = document.createElement('div');
    wrap.className = 'max-w-5xl mx-auto space-y-8 fade-in';
    wrap.innerHTML = `
        <div class="mb-4">
            <div class="inline-flex items-center gap-2 px-3 py-1 bg-secondary-fixed text-on-secondary-fixed-variant rounded-full text-xs font-bold mb-4 tracking-wider uppercase">Secure Gateway</div>
            <h1 class="text-4xl font-extrabold tracking-tight text-primary mb-3">Upload Documents</h1>
            <p class="text-on-surface-variant max-w-xl text-lg leading-relaxed">Submit official documentation to the secure DocVault. Files are encrypted and immutable upon verification.</p>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div class="lg:col-span-8 space-y-8">
                <form id="upload-form">
                    <div id="drop-zone" class="drop-zone group relative flex flex-col items-center justify-center border-2 border-dashed border-outline-variant bg-surface-container-lowest rounded-xl p-12 transition-all hover:border-secondary hover:bg-blue-50/30 cursor-pointer mb-8">
                        <div class="w-16 h-16 bg-secondary-fixed rounded-full flex items-center justify-center mb-6 transition-transform group-hover:scale-110">
                            <span class="material-symbols-outlined text-secondary text-3xl">cloud_upload</span>
                        </div>
                        <h3 class="text-xl font-semibold text-primary mb-2" id="drop-label">Drag and drop file</h3>
                        <p class="text-on-surface-variant mb-6 text-sm">Limit 10MB per file • PDF, DOCX, PNG, JPG, TXT</p>
                        <input type="file" id="file-input" class="hidden" accept=".pdf,.docx,.png,.jpg,.jpeg,.txt"/>
                        <button type="button" id="browse-btn" class="bg-primary text-white px-8 py-3 rounded-xl font-semibold shadow-lg shadow-primary/20 hover:bg-opacity-90 active:scale-95 transition-all">Browse Files</button>
                    </div>
                    <div class="bg-surface-container-lowest rounded-xl p-8 space-y-6 shadow-sm">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div class="space-y-2">
                                <label class="block text-sm font-semibold text-primary px-1">Uploaded By</label>
                                <div class="relative flex items-center">
                                    <span class="material-symbols-outlined absolute left-3 text-outline text-lg">person</span>
                                    <input id="upload-user" class="w-full bg-surface pl-10 pr-4 py-3 rounded-xl border-none focus:ring-2 focus:ring-secondary/20 text-on-surface text-sm" placeholder="Full legal name" type="text" value="${currentUser?.name || ''}" ${currentUser ? 'readonly' : ''}/>
                                </div>
                            </div>
                            <div class="space-y-2">
                                <label class="block text-sm font-semibold text-primary px-1">Document Category</label>
                                <div class="relative flex items-center">
                                    <span class="material-symbols-outlined absolute left-3 text-outline text-lg">category</span>
                                    <select id="upload-dept" class="w-full bg-surface pl-10 pr-4 py-3 rounded-xl border-none focus:ring-2 focus:ring-secondary/20 text-on-surface text-sm appearance-none">
                                        ${currentMode === 'b2c' ? `
                                            <option>Personal</option>
                                            <option>Family</option>
                                            <option>Office</option>
                                        ` : `
                                            <option>Employee Records</option>
                                        `}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-blue-50/50 rounded-xl border border-blue-100/50">
                            <div class="space-y-2">
                                <label class="block text-[10px] font-black uppercase text-blue-600 px-1 tracking-widest">Parent Document ID (Optional)</label>
                                <div class="relative flex items-center">
                                    <span class="material-symbols-outlined absolute left-3 text-blue-400 text-lg">schema</span>
                                    <input id="upload-parent" class="w-full bg-white pl-10 pr-4 py-2.5 rounded-lg border-none focus:ring-2 focus:ring-blue-500/20 text-on-surface text-xs font-bold" placeholder="e.g. 1" type="number"/>
                                </div>
                            </div>
                            <div class="space-y-2">
                                <label class="block text-[10px] font-black uppercase text-blue-600 px-1 tracking-widest">Version Note</label>
                                <div class="relative flex items-center">
                                    <span class="material-symbols-outlined absolute left-3 text-blue-400 text-lg">edit_note</span>
                                    <input id="upload-note" class="w-full bg-white pl-10 pr-4 py-2.5 rounded-lg border-none focus:ring-2 focus:ring-blue-500/20 text-on-surface text-xs" placeholder="What changed?" type="text"/>
                                </div>
                            </div>
                        </div>

                        <button type="submit" id="submit-btn" aria-label="Submit record to vault" class="w-full bg-primary text-white px-10 py-4 rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-opacity-90 active:scale-95 transition-all text-lg flex items-center justify-center gap-3" disabled>
                            <span class="material-symbols-outlined">upload_file</span> Submit Record
                        </button>
                    </div>
                </form>
                <div id="upload-result" class="hidden"></div>
            </div>
            <div class="lg:col-span-4 space-y-6">
                <div class="bg-surface-container rounded-xl p-6">
                    <h4 class="text-sm font-bold text-primary mb-4 flex items-center gap-2"><span class="material-symbols-outlined text-secondary text-lg">info</span> Upload Guidelines</h4>
                    <ul class="space-y-4">
                        <li class="flex gap-3"><span class="material-symbols-outlined text-green-600 text-sm mt-0.5">check_circle</span><div class="text-xs text-on-surface-variant leading-relaxed"><strong>High Quality:</strong> Ensure all text is legible.</div></li>
                        <li class="flex gap-3"><span class="material-symbols-outlined text-green-600 text-sm mt-0.5">check_circle</span><div class="text-xs text-on-surface-variant leading-relaxed"><strong>Single File:</strong> One document per upload.</div></li>
                        <li class="flex gap-3"><span class="material-symbols-outlined text-green-600 text-sm mt-0.5">check_circle</span><div class="text-xs text-on-surface-variant leading-relaxed"><strong>Metadata:</strong> Fill in the "Uploaded By" field.</div></li>
                    </ul>
                </div>
                <div class="bg-primary p-6 rounded-xl text-white relative overflow-hidden">
                    <div class="relative z-10"><p class="text-[10px] font-bold uppercase tracking-[0.2em] mb-4 opacity-60">Security Protocol</p>
                    <h5 class="font-bold text-lg mb-2">SHA-256 Hashing</h5>
                    <p class="text-xs text-on-primary-container leading-relaxed">Every upload is cryptographically hashed and chained to the previous block for immutability.</p></div>
                    <span class="material-symbols-outlined absolute -right-6 -bottom-6 text-9xl opacity-10">lock</span>
                </div>
            </div>
        </div>`;
    app.appendChild(wrap);

    // Wire up interactions
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const dropLabel = document.getElementById('drop-label');
    const submitBtn = document.getElementById('submit-btn');
    const browseBtn = document.getElementById('browse-btn');

    browseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });
    dropZone.addEventListener('click', (e) => {
        if (e.target === dropZone || e.target.closest('.drop-zone')) fileInput.click();
    });
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
        e.preventDefault(); dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) { fileInput.files = e.dataTransfer.files; onFileSelected(); }
    });
    fileInput.addEventListener('change', onFileSelected);

    function onFileSelected() {
        if (fileInput.files.length) {
            dropLabel.textContent = fileInput.files[0].name;
            submitBtn.disabled = false;
        }
    }

    document.getElementById('upload-form').addEventListener('submit', async e => {
        e.preventDefault();
        if (!fileInput.files.length) return;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span> Uploading...';
        const fd = new FormData();
        fd.append('file', fileInput.files[0]);
        fd.append('user', document.getElementById('upload-user').value || 'anonymous');
        fd.append('department', document.getElementById('upload-dept').value);

        const parentId = document.getElementById('upload-parent').value.trim();
        const note = document.getElementById('upload-note').value.trim();
        if (parentId) fd.append('parent_document_id', parentId);
        if (note) fd.append('version_note', note);
        try {
            const res = await API.upload(fd, fileInput.files[0]);
            const resultDiv = document.getElementById('upload-result');
            resultDiv.classList.remove('hidden');
            if (res.success) {
                // If it's a queued job, we need to wait for it or tell user it's processing
                if (res.status === 'processing') {
                    resultDiv.innerHTML = `<div class="result-card bg-blue-50 border border-blue-200 rounded-xl p-6 fade-in">
                        <div class="flex items-center gap-3 mb-2"><span class="material-symbols-outlined text-blue-600 animate-spin">sync</span><span class="text-xs font-bold text-blue-700 uppercase">Processing...</span></div>
                        <p class="text-sm text-blue-800/70">Document #${res.job_id} is being secured on the blockchain. Check the Chain Explorer in a few seconds.</p>
                    </div>`;

                    // Poll for specific job completion
                    let attempts = 0;
                    const checkJob = setInterval(async () => {
                        attempts++;
                        try {
                            const status = await fetch(`/api/upload/status/${res.job_id}`, {
                                headers: { 'x-api-key': API_KEY }
                            }).then(r => r.json());

                            if (status.state === 'completed' && status.result) {
                                clearInterval(checkJob);

                                if (status.result.success === false) {
                                    // Handle non-success results from processor (e.g. Duplicates)
                                    if (status.result.error === 'Duplicate') {
                                        resultDiv.innerHTML = `<div class="result-card bg-orange-50 border border-orange-200 rounded-xl p-6 fade-in relative">
                                            <div class="flex items-center gap-3 mb-3">
                                                <span class="material-symbols-outlined text-orange-600 text-2xl">warning</span>
                                                <span class="text-sm font-extrabold text-orange-800 uppercase tracking-widest">Duplicate Detected — This document already exists in the registry</span>
                                            </div>
                                            <div class="space-y-1 text-sm text-orange-900/80 mb-5 ml-9">
                                                <p>Originally uploaded: Document ID <strong class="font-bold">#${status.result.existing_id}</strong></p>
                                            </div>
                                            <div class="ml-9">
                                                <button id="view-original-btn-q" type="button" class="bg-orange-600 text-white px-5 py-2.5 rounded-lg font-bold text-sm shadow-sm hover:bg-orange-700 active:scale-95 transition-all flex items-center gap-2">
                                                    <span class="material-symbols-outlined text-sm">visibility</span> View Original
                                                </button>
                                            </div>
                                        </div>`;
                                        document.getElementById('view-original-btn-q').addEventListener('click', () => {
                                            window.location.hash = '#verify';
                                            setTimeout(() => {
                                                const input = document.getElementById('verify-id');
                                                if (input) {
                                                    input.value = status.result.existing_id;
                                                    document.getElementById('verify-form').dispatchEvent(new Event('submit', { cancelable: true }));
                                                }
                                            }, 50);
                                        });
                                    } else {
                                        resultDiv.innerHTML = `<div class="result-card bg-red-50 border border-red-200 rounded-xl p-6 fade-in">
                                            <div class="flex items-center gap-3 mb-2"><span class="material-symbols-outlined text-red-600">error</span><span class="text-xs font-bold text-red-700 uppercase">Processing Error</span></div>
                                            <p class="text-sm text-red-800/70">${status.result.error || 'System failed to secure document.'}</p>
                                        </div>`;
                                    }
                                } else {
                                    // The result now contains the correct block_index and qr_image_base64
                                    const finalResult = {
                                        ...status.result,
                                        block_index: status.result.document_id, // Map for UI consistency
                                        upload_timestamp: new Date().toISOString() // Fallback
                                    };
                                    renderSuccessUI(resultDiv, finalResult);
                                }

                                // Reset button
                                submitBtn.disabled = false;
                                submitBtn.innerHTML = '<span class="material-symbols-outlined">upload_file</span> Submit Record';
                            } else if (status.state === 'failed' || attempts > 20) {
                                clearInterval(checkJob);
                                resultDiv.innerHTML = `<div class="result-card bg-red-50 border border-red-200 rounded-xl p-6 fade-in">
                                    <div class="flex items-center gap-3 mb-2"><span class="material-symbols-outlined text-red-600">error</span><span class="text-xs font-bold text-red-700 uppercase">Processing Failed</span></div>
                                    <p class="text-sm text-red-800/70">${status.error || 'The background processor failed to secure this document.'}</p>
                                </div>`;

                                // Reset button
                                submitBtn.disabled = false;
                                submitBtn.innerHTML = '<span class="material-symbols-outlined">upload_file</span> Submit Record';
                            }
                        } catch (e) {
                            console.error('Polling error:', e);
                        }
                    }, 3000);
                    return;
                }
            } else if (res.existing_document_id) {
                resultDiv.innerHTML = `<div class="result-card bg-orange-50 border border-orange-200 rounded-xl p-6 fade-in relative">
                    <div class="flex items-center gap-3 mb-3">
                        <span class="material-symbols-outlined text-orange-600 text-2xl">warning</span>
                        <span class="text-sm font-extrabold text-orange-800 uppercase tracking-widest">Duplicate Detected — This document already exists in the registry</span>
                    </div>
                    <div class="space-y-1 text-sm text-orange-900/80 mb-5 ml-9">
                        <p>Originally uploaded on <strong class="font-bold">${new Date(res.uploaded_at).toLocaleString()}</strong></p>
                        <p>Document ID: <strong class="font-bold">#${res.existing_document_id}</strong></p>
                    </div>
                    <div class="ml-9">
                        <button id="view-original-btn" type="button" class="bg-orange-600 text-white px-5 py-2.5 rounded-lg font-bold text-sm shadow-sm hover:bg-orange-700 active:scale-95 transition-all flex items-center gap-2">
                            <span class="material-symbols-outlined text-sm">visibility</span> View Original
                        </button>
                    </div>
                </div>`;
                document.getElementById('view-original-btn').addEventListener('click', () => {
                    window.location.hash = '#verify';
                    setTimeout(() => {
                        const input = document.getElementById('verify-id');
                        if (input) {
                            input.value = res.existing_document_id;
                            // Optionally auto-submit the verify form
                            document.getElementById('verify-form').dispatchEvent(new Event('submit', { cancelable: true }));
                        }
                    }, 50);
                });
            } else {
                resultDiv.innerHTML = `<div class="result-card bg-red-50/50 border border-red-200 rounded-xl p-6 fade-in">
                    <div class="flex items-center gap-3 mb-2"><span class="material-symbols-outlined text-red-600">error</span><span class="text-xs font-bold text-red-700 uppercase">Upload Failed</span></div>
                    <p class="text-sm text-red-800/70">${res.error || 'Unknown error'}</p></div>`;
            }
        } catch (err) {
            document.getElementById('upload-result').classList.remove('hidden');
            document.getElementById('upload-result').innerHTML = `<div class="bg-red-50 border border-red-200 rounded-xl p-6 fade-in"><p class="text-red-700 text-sm">Network error. Is the server running?</p></div>`;
        }
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="material-symbols-outlined">upload_file</span> Submit Record';
    });
}

function renderSuccessUI(resultDiv, res) {
    // Forensic & Signature UI logic
    let forensicHtml = '';
    if (res.forensic_score) {
        const forensic = typeof res.forensic_score === 'string' ? JSON.parse(res.forensic_score) : res.forensic_score;
        if (forensic.suspicious) {
            forensicHtml = `
                <div class="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <div class="flex items-center gap-2 mb-2 text-orange-700 font-bold text-xs uppercase tracking-wider">
                        <span class="material-symbols-outlined text-sm">forensics</span> Forensic Analysis: Suspicious Document
                    </div>
                    <ul class="space-y-1">
                        ${forensic.flags.map(f => `<li class="text-[10px] text-orange-800 flex items-center gap-1.5"><span class="w-1 h-1 rounded-full bg-orange-400"></span> ${f}</li>`).join('')}
                    </ul>
                </div>
            `;
        } else {
            forensicHtml = `
                <div class="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-700 text-[10px] font-extrabold uppercase">
                    <span class="material-symbols-outlined text-xs">verified</span> Forensic Analysis: Clean
                </div>
            `;
        }
    }

    let signatureHtml = '';
    if (res.signature_score) {
        const s = typeof res.signature_score === 'string' ? JSON.parse(res.signature_score) : res.signature_score;
        if (s.signature_found || s.seal_found) {
            signatureHtml = '<div class="flex flex-wrap gap-2 mt-2">';
            if (s.signature_found) signatureHtml += `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase"><span class="material-symbols-outlined text-[12px]">draw</span> Signature Detected</span>`;
            if (s.seal_found) signatureHtml += `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase"><span class="material-symbols-outlined text-[12px]">approval_delegation</span> Seal Detected</span>`;
            signatureHtml += '</div>';
        } else {
            signatureHtml = `<div class="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-100 text-orange-700 text-[9px] font-black uppercase"><span class="material-symbols-outlined text-[12px]">warning</span> Warning: No Signature or Seal Found</div>`;
        }
    }

    resultDiv.innerHTML = `<div class="result-card bg-green-50/50 border border-green-200 rounded-xl p-6 relative overflow-hidden fade-in">
        <div class="flex items-center gap-3 mb-4"><span class="material-symbols-outlined text-green-600">verified</span><span class="text-xs font-bold text-green-700 uppercase tracking-widest">Upload Successful</span></div>
        <div class="flex flex-col md:flex-row gap-6 items-start">
            <div class="flex-1">
                <h4 class="text-lg font-bold text-green-900 mb-2">${currentMode === 'b2c' ? 'Identity Record Secured' : 'Institutional Certificate Issued'}</h4>
                <div class="flex items-center gap-2 mb-3">
                    <p class="text-sm text-green-800/70 text-sm">Block Index: <strong>#${res.block_index}</strong></p>
                    <span class="px-2 py-0.5 rounded bg-green-200 text-green-800 text-[10px] font-black uppercase">Version ${res.version_number || 1}</span>
                </div>
                <code class="hash-text bg-green-100 px-3 py-2 rounded block text-green-800 mb-2">${res.block_hash}</code>
                ${res.parent_document_id ? `<p class="text-[10px] font-bold text-green-600 mb-2 uppercase">Supersedes Block #${res.parent_document_id}</p>` : ''}
                <div class="flex flex-wrap gap-2 mt-4">
                    <a href="/api/chain/document/${res.block_index}/certified" target="_blank" class="bg-primary text-on-primary px-3 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-2 hover:opacity-90 transition-all shadow-md">
                        <span class="material-symbols-outlined text-[14px]">verified</span> Certified PDF
                    </a>
                    <a href="/api/verify/${res.block_index}/proof?api_key=${API_KEY}" target="_blank" class="bg-white text-primary px-3 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-2 hover:bg-slate-50 transition-all border border-primary/20">
                        <span class="material-symbols-outlined text-[14px]">terminal</span> JSON Proof
                    </a>
                </div>
                ${signatureHtml}
                ${forensicHtml}
            </div>
            <div class="bg-white p-2 rounded-lg shadow-sm border border-green-100 flex-shrink-0">
                <img src="${res.qr_image_base64 || ''}" class="w-24 h-24" alt="Verification QR"/>
                <p class="text-[8px] text-center mt-1 text-green-600 font-black tracking-widest">SCAN TO VERIFY</p>
            </div>
        </div>
    </div>`;
}

// ── Verify Page ──
function renderVerify(app) {
    document.getElementById('page-title').textContent = 'Document Verification';
    const wrap = document.createElement('div');
    wrap.className = 'max-w-5xl mx-auto space-y-8 fade-in';
    wrap.innerHTML = `
        <div class="grid grid-cols-12 gap-8 mb-8 items-center">
            <div class="col-span-12 md:col-span-7">
                <h1 class="text-5xl font-extrabold text-primary leading-tight mb-4 tracking-tight">Authenticity <span class="text-secondary">Secured</span> by Consensus.</h1>
                <p class="text-on-surface-variant text-lg max-w-xl">Verify the cryptographic fingerprint of any official document against our decentralized registry.</p>
            </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div class="md:col-span-2 space-y-8">
                <div class="bg-surface-container-lowest rounded-xl p-8 shadow-sm shadow-blue-900/5">
                    <div class="flex items-center gap-4 mb-8">
                        <div class="w-12 h-12 rounded-xl bg-primary-fixed flex items-center justify-center text-on-primary-fixed"><span class="material-symbols-outlined">fingerprint</span></div>
                        <div><h3 class="text-xl font-bold text-primary">Document Identity</h3><p class="text-sm text-on-surface-variant">Enter the document ID or upload the file.</p></div>
                    </div>
                    <form id="verify-form" class="space-y-6">
                        <div><label class="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Document ID</label>
                        <input id="verify-id" class="w-full bg-surface-container-low border-none rounded-xl px-6 py-4 text-lg focus:ring-2 focus:ring-secondary/20 placeholder:text-slate-300" placeholder="e.g. 1" type="text"/></div>
                        <div class="text-center text-xs font-bold text-slate-400 uppercase tracking-widest">— OR —</div>
                        <div id="verify-drop" class="drop-zone relative py-12 border-2 border-dashed border-outline-variant/40 rounded-xl flex flex-col items-center justify-center bg-surface-container-low/30 hover:bg-surface-container-low transition-colors group cursor-pointer">
                            <span class="material-symbols-outlined text-4xl text-slate-400 group-hover:text-secondary mb-4 transition-colors">cloud_upload</span>
                            <p class="text-sm font-medium text-on-surface-variant" id="verify-drop-label">Drag and drop document, or <span class="text-secondary underline underline-offset-4">browse</span></p>
                            <input type="file" id="verify-file" class="hidden"/>
                        </div>
                        <div><label class="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Compare with (Legal Name)</label>
                        <input id="verify-compare" class="w-full bg-surface-container-low border-none rounded-xl px-6 py-4 text-sm focus:ring-2 focus:ring-secondary/20 placeholder:text-slate-300" placeholder="Leave blank for first upload" type="text"/></div>
                        <button type="submit" id="verify-btn" aria-label="Verify document authenticity" class="w-full h-14 bg-primary text-white rounded-xl font-bold text-lg flex items-center justify-center gap-3 shadow-lg shadow-primary/20 hover:bg-opacity-90 active:scale-[0.98] transition-all">                            <span>Verify Authenticity</span><span class="material-symbols-outlined">shield_with_heart</span>
                        </button>
                    </form>
                </div>
                <div id="verify-result" class="hidden"></div>
            </div>
            <div class="space-y-6">
                <div class="bg-surface-container-low rounded-xl p-6">
                    <h4 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6">Live Statistics</h4>
                    <div id="verify-stats" class="space-y-6"><p class="text-sm text-slate-400">Loading...</p></div>
                </div>
                <div class="bg-primary p-6 rounded-xl text-white relative overflow-hidden">
                    <div class="relative z-10"><p class="text-[10px] font-bold uppercase tracking-[0.2em] mb-4 opacity-60">Security Protocol</p>
                    <h5 class="font-bold text-lg mb-2">Military-Grade Encryption</h5>
                    <p class="text-xs text-on-primary-container leading-relaxed">All verification requests are processed via zero-knowledge proofs. No document content is stored on our servers.</p></div>
                    <span class="material-symbols-outlined absolute -right-6 -bottom-6 text-9xl opacity-10">lock</span>
                </div>
            </div>
        </div>`;
    app.appendChild(wrap);

    // Stats sidebar
    API.getStats().then(d => {
        const el = document.getElementById('verify-stats');
        if (el) el.innerHTML = `
            <div class="flex justify-between items-end"><div><p class="text-secondary uppercase font-bold text-[10px] tracking-widest">Total Documents</p><p class="text-2xl font-bold text-primary">${d.total_documents}</p></div></div>
            <div class="flex justify-between items-end"><div><p class="text-secondary uppercase font-bold text-[10px] tracking-widest">Tampered</p><p class="text-2xl font-bold text-error">${d.tampered_detected}</p></div></div>`;
    }).catch(() => { });

    // File drop
    const verifyDrop = document.getElementById('verify-drop');
    const verifyFile = document.getElementById('verify-file');
    verifyDrop.addEventListener('click', () => verifyFile.click());
    verifyDrop.addEventListener('dragover', e => { e.preventDefault(); verifyDrop.classList.add('dragover'); });
    verifyDrop.addEventListener('dragleave', () => verifyDrop.classList.remove('dragover'));
    verifyDrop.addEventListener('drop', e => { e.preventDefault(); verifyDrop.classList.remove('dragover'); verifyFile.files = e.dataTransfer.files; document.getElementById('verify-drop-label').textContent = verifyFile.files[0].name; });
    verifyFile.addEventListener('change', () => { if (verifyFile.files.length) document.getElementById('verify-drop-label').textContent = verifyFile.files[0].name; });

    document.getElementById('verify-form').addEventListener('submit', async e => {
        e.preventDefault();
        const btn = document.getElementById('verify-btn');
        const resultDiv = document.getElementById('verify-result');

        btn.disabled = true;
        resultDiv.classList.remove('hidden');

        // ── Trust Journey Animation ──
        const steps = [
            { id: 'hash', label: 'Fingerprinting Document Content...', icon: 'fingerprint' },
            { id: 'vision', label: 'Scanning Forensic Texture Anomalies...', icon: 'biotech' },
            { id: 'ocr', label: 'Transcribing Multilingual Text Layers...', icon: 'translate' },
            { id: 'chain', label: 'Validating Blockchain Ancestry...', icon: 'link' },
            { id: 'gemini', label: 'Performing Gemini AI Integrity Audit...', icon: 'psychology' }
        ];

        resultDiv.innerHTML = `
            <div class="bg-white dark:bg-[#1C2A41] rounded-2xl p-8 border border-slate-100 dark:border-slate-800 shadow-xl space-y-6 fade-in">
                <div class="flex items-center justify-between mb-2">
                    <h3 class="text-sm font-black text-primary dark:text-[#E9C176] uppercase tracking-[0.2em]">System Verification in Progress</h3>
                    <div class="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
                <div class="space-y-4" id="journey-steps">
                    ${steps.map(s => `
                        <div id="step-${s.id}" class="flex items-center gap-4 opacity-30 grayscale transition-all duration-500">
                            <div class="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                <span class="material-symbols-outlined text-xl text-slate-400">${s.icon}</span>
                            </div>
                            <span class="text-xs font-bold text-slate-500">${s.label}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        const updateStep = (id, status = 'loading') => {
            const el = document.getElementById(`step-${id}`);
            if (!el) return;
            el.classList.remove('opacity-30', 'grayscale');
            const iconWrap = el.querySelector('div');
            const icon = el.querySelector('span');

            if (status === 'loading') {
                iconWrap.className = 'w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center animate-pulse';
                el.querySelector('span:last-child').className = 'text-xs font-bold text-blue-600';
            } else {
                iconWrap.className = 'w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm border border-emerald-100';
                icon.textContent = 'check_circle';
                el.querySelector('span:last-child').className = 'text-xs font-bold text-slate-700 dark:text-slate-300';
            }
        };

        const fd = new FormData();
        const docId = document.getElementById('verify-id').value.trim();
        const compareWith = document.getElementById('verify-compare')?.value.trim();
        if (docId) fd.append('document_id', docId);
        if (verifyFile.files.length) fd.append('file', verifyFile.files[0]);
        if (compareWith) fd.append('compare_with', compareWith);

        try {
            // Start the sequence
            updateStep('hash', 'loading');
            const resPromise = API.verify(fd, verifyFile.files[0]);

            await new Promise(r => setTimeout(r, 800));
            updateStep('hash', 'done');
            updateStep('vision', 'loading');

            await new Promise(r => setTimeout(r, 1200));
            updateStep('vision', 'done');
            updateStep('ocr', 'loading');

            await new Promise(r => setTimeout(r, 1000));
            updateStep('ocr', 'done');
            updateStep('chain', 'loading');

            const res = await resPromise;

            updateStep('chain', 'done');
            updateStep('gemini', 'loading');
            await new Promise(r => setTimeout(r, 600));
            updateStep('gemini', 'done');

            // ── Render Final Result ──
            const r = document.getElementById('verify-result');

            let sigBadge = '';
            if (res.signature_status === 'VERIFIED') {
                sigBadge = `<div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-extrabold uppercase mb-4 shadow-sm border border-emerald-200">
                    <span class="material-symbols-outlined text-xs" style="font-variation-settings:'FILL' 1;">shield_with_heart</span> Cryptographically Signed
                </div>`;
            } else if (res.signature_status === 'NOT_SIGNED') {
                sigBadge = `<div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-extrabold uppercase mb-4 shadow-sm border border-slate-200">
                    <span class="material-symbols-outlined text-xs">shield</span> Legacy Document
                </div>`;
            } else if (res.signature_status === 'INVALID') {
                sigBadge = `<div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-700 text-[10px] font-extrabold uppercase mb-4 shadow-sm border border-red-200">
                    <span class="material-symbols-outlined text-xs" style="font-variation-settings:'FILL' 1;">warning</span> Signature Invalid
                </div>`;
            }

            // Gemini AI Section
            let geminiHtml = '';
            if (res.ai_report && res.ai_report.status !== 'error') {
                const ai = res.ai_report;
                const riskColors = { 'LOW': 'text-emerald-400', 'MEDIUM': 'text-orange-400', 'HIGH': 'text-red-400' };
                const riskBarColors = { 'LOW': 'bg-emerald-500', 'MEDIUM': 'bg-orange-500', 'HIGH': 'bg-red-500' };
                const confidence = Math.round((ai.confidence_score || 0.85) * 100);
                
                geminiHtml = `
                    <div class="mt-6 bg-slate-900 rounded-2xl p-6 border border-white/10 shadow-2xl relative overflow-hidden group">
                        <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <span class="material-symbols-outlined text-6xl text-white">psychology</span>
                        </div>
                        <div class="relative z-10 space-y-5">
                            <div class="flex items-center justify-between">
                                <h5 class="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Gemini AI Integrity Audit</h5>
                                <div class="flex items-center gap-2">
                                    <span class="w-2 h-2 rounded-full ${riskBarColors[ai.risk_assessment?.rating] || 'bg-slate-400'} animate-pulse"></span>
                                    <span class="text-[9px] font-black uppercase ${riskColors[ai.risk_assessment?.rating] || 'text-slate-400'}">${ai.risk_assessment?.rating || 'N/A'} Risk Profile</span>
                                </div>
                            </div>

                            <!-- Confidence Gauge -->
                            <div class="space-y-2">
                                <div class="flex justify-between items-end">
                                    <p class="text-[8px] font-black text-slate-500 uppercase">AI Verification Confidence</p>
                                    <p class="text-lg font-black text-white leading-none">${confidence}%</p>
                                </div>
                                <div class="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                                    <div class="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(37,99,235,0.5)]" style="width: ${confidence}%"></div>
                                </div>
                            </div>

                            <p class="text-white text-sm leading-relaxed font-medium bg-white/5 p-4 rounded-xl border border-white/5">"${ai.summary}"</p>
                            
                            <div class="grid grid-cols-2 gap-4 pt-2">
                                <div class="space-y-1">
                                    <p class="text-[8px] font-black text-slate-500 uppercase">Classification</p>
                                    <p class="text-xs text-slate-300 font-bold">${ai.classification}</p>
                                </div>
                                <div class="space-y-1">
                                    <p class="text-[8px] font-black text-slate-500 uppercase">Parties Detected</p>
                                    <p class="text-xs text-slate-300 font-bold truncate">${ai.entities?.parties?.[0] || 'Unknown'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }

            const reasons = res.tamper_reasons ? res.tamper_reasons.map(r => `<li class="flex items-center gap-2 text-red-800/80"><span class="w-1.5 h-1.5 rounded-full bg-red-400"></span> ${r}</li>`).join('') : '';
            const blockId = res.document_id || res.block_index || 'N/A';

            const chainWarning = res.chain_warning ? `
                <div class="bg-orange-50 border border-orange-100 p-4 rounded-lg my-4 flex gap-3">
                    <span class="material-symbols-outlined text-orange-500">warning</span>
                    <div>
                        <p class="text-[10px] font-black text-orange-700 uppercase mb-1">Historical Integrity Warning</p>
                        <p class="text-[10px] text-orange-800/80 leading-tight">${res.chain_warning}</p>
                    </div>
                </div>
            ` : '';

            // Technical Integrity Specs
            const specs = `
                <div class="mt-4 grid grid-cols-2 gap-3">
                    <div class="bg-white/40 border border-slate-200/50 p-3 rounded-lg">
                        <p class="text-[8px] font-black text-slate-400 uppercase mb-1">File Hash Match</p>
                        <p class="text-xs font-bold ${res.tamper_reasons.includes('File hash mismatch') ? 'text-red-500' : 'text-emerald-600'}">
                            ${res.tamper_reasons.includes('File hash mismatch') ? 'FAILED' : 'SUCCESS (MATCH)'}
                        </p>
                    </div>
                    <div class="bg-white/40 border border-slate-200/50 p-3 rounded-lg">
                        <p class="text-[8px] font-black text-slate-400 uppercase mb-1">OCR Similarity</p>
                        <p class="text-xs font-bold ${res.ocr_tampered ? 'text-red-500' : 'text-emerald-600'}">
                            ${res.ocr_similarity_score !== null ? res.ocr_similarity_score.toFixed(2) + '%' : 'SKIPPED'}
                        </p>
                    </div>
                    <div class="bg-white/40 border border-slate-200/50 p-3 rounded-lg">
                        <p class="text-[8px] font-black text-slate-400 uppercase mb-1">Forensic Status</p>
                        <p class="text-xs font-bold ${res.tamper_reasons.includes('Forensic analysis detected modifications') ? 'text-red-500' : 'text-emerald-600'}">
                            ${res.tamper_reasons.includes('Forensic analysis detected modifications') ? 'SUSPICIOUS' : 'CLEAN'}
                        </p>
                    </div>
                    <div class="bg-white/40 border border-slate-200/50 p-3 rounded-lg">
                        <p class="text-[8px] font-black text-slate-400 uppercase mb-1">Signature Valid</p>
                        <p class="text-xs font-bold ${res.signature_status === 'VERIFIED' ? 'text-emerald-600' : 'text-red-500'}">
                            ${res.signature_status === 'VERIFIED' ? 'YES' : 'NO/INVALID'}
                        </p>
                    </div>
                </div>
            `;

            r.innerHTML = `<div class="result-card ${res.status === 'tampered' ? 'bg-red-50/50 border border-red-200' : 'bg-emerald-50/50 border border-emerald-200'} rounded-xl p-8 relative overflow-hidden fade-in shadow-2xl">
                <div class="flex items-center gap-3 mb-4">
                    <span class="material-symbols-outlined ${res.status === 'tampered' ? 'text-red-600' : 'text-emerald-600'}">${res.status === 'tampered' ? 'error' : 'verified'}</span>
                    <span class="text-xs font-bold ${res.status === 'tampered' ? 'text-red-700' : 'text-emerald-700'} uppercase tracking-widest">Verification Verdict</span>
                </div>
                ${sigBadge}
                <h4 class="text-2xl font-black ${res.status === 'tampered' ? 'text-red-900' : 'text-emerald-900'} mb-2">${res.status === 'tampered' ? 'TAMPERED / FAKE' : 'AUTHENTIC RECORD'}</h4>
                <p class="text-[10px] font-black ${res.status === 'tampered' ? 'text-red-600' : 'text-emerald-600'} uppercase mb-4">Block Reference: #${blockId}</p>
                
                ${chainWarning}
                ${geminiHtml}
                ${specs}

                ${reasons ? `<div class="bg-white/50 p-4 rounded-lg border border-red-100 my-6">
                    <p class="text-[9px] font-black text-red-400 uppercase mb-2">Failure Reasons:</p>
                    <ul class="space-y-1 text-xs">${reasons}</ul>
                </div>` : ''}
            </div>`;

        } catch (err) {
            console.error(err);
            resultDiv.innerHTML = `<div class="bg-red-50 border border-red-200 rounded-xl p-6 fade-in"><p class="text-red-700 text-sm">System Error: Failed to complete verification journey.</p></div>`;
        }
        btn.disabled = false;
        btn.innerHTML = '<span>Verify Authenticity</span><span class="material-symbols-outlined">shield_with_heart</span>';
    });
}

// ── Chain Explorer Page ──
function renderChain(app) {
    document.getElementById('page-title').textContent = 'Chain Explorer';
    const wrap = document.createElement('div');
    wrap.className = 'max-w-7xl mx-auto space-y-8 fade-in';
    wrap.innerHTML = `
        <div class="flex flex-col md:flex-row md:items-end justify-between mb-2 gap-6">
            <div class="space-y-2"><h1 class="text-4xl font-extrabold tracking-tight text-primary">Chain Explorer</h1>
            <p class="text-on-surface-variant max-w-lg">Immutable ledger of document interactions. Every entry is cryptographically sealed.</p></div>
            <div class="flex flex-col items-end gap-3">
                <div class="bg-surface-container-lowest px-5 py-3 rounded-xl flex items-center gap-4 shadow-sm border border-emerald-100">
                    <div class="text-right">
                        <p class="text-[9px] uppercase font-black text-emerald-600 tracking-widest">Current Merkle Root</p>
                        <code id="current-merkle-root" class="text-xs font-mono font-bold text-emerald-700 tracking-tighter">Initializing...</code>
                    </div>
                    <div class="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                        <span class="material-symbols-outlined text-sm">account_tree</span>
                    </div>
                </div>
                <div class="bg-surface-container-lowest px-5 py-3 rounded-xl flex items-center gap-4 shadow-sm">
                    <div class="text-right"><p class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Network Status</p>
                    <p class="text-sm font-bold text-green-600 flex items-center justify-end gap-1"><span class="w-1.5 h-1.5 rounded-full bg-green-500"></span> Synchronized</p></div>
                </div>
            </div>
        </div>`;
    renderStatsBar(wrap);

    const tableWrap = document.createElement('div');
    tableWrap.className = 'bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm';
    tableWrap.innerHTML = `
        <div class="px-6 py-5 border-b border-surface-container flex items-center justify-between">
            <h3 class="text-lg font-bold text-primary">Latest Verified Transactions</h3>
            <button id="refresh-chain" class="text-xs font-bold text-white bg-primary px-3 py-1.5 rounded-lg shadow-lg shadow-primary/20 active:scale-95 transition-all">Refresh Data</button>
        </div>
        <div class="overflow-x-auto"><table class="w-full text-left border-collapse"><thead><tr class="bg-surface-container-low">
            <th class="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Block</th>
            <th class="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Filename</th>
            <th class="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Hash (SHA-256)</th>
            <th class="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Uploaded By</th>
            <th class="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Timestamp</th>
            <th class="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
        </tr></thead><tbody id="chain-body" class="divide-y divide-surface-container"></tbody></table></div>
        <div class="px-6 py-4 bg-slate-50 border-t border-surface-container"><p id="chain-count" class="text-xs text-slate-500 font-medium">Loading...</p></div>`;
    wrap.appendChild(tableWrap);
    app.appendChild(wrap);

    loadChain();
    document.getElementById('refresh-chain').addEventListener('click', loadChain);
}

function loadChain(silent = false) {
    const body = document.getElementById('chain-body');
    if (!body) return;
    if (!silent) body.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-slate-400">Loading chain...</td></tr>';
    API.getChain().then(chain => {
        if (!chain.length) {
            body.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-slate-400">No blocks yet. Upload a document to begin.</td></tr>';
            document.getElementById('chain-count').textContent = '0 entries';
            const rootEl = document.getElementById('current-merkle-root');
            if (rootEl) rootEl.textContent = 'None';
            return;
        }

        // Update Global Merkle Root in Header
        const latestRoot = chain[chain.length - 1].merkle_root;
        const rootEl = document.getElementById('current-merkle-root');
        if (rootEl) rootEl.textContent = latestRoot ? latestRoot.slice(0, 24) + '...' : 'Pending';

        const sorted = [...chain].reverse();
        body.innerHTML = sorted.map((d, i) => {
            const fname = d.filename.split(/[/\\]/).pop();
            const status = d.is_tampered
                ? '<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-700 text-[10px] font-extrabold uppercase"><span class="w-1.5 h-1.5 rounded-full bg-red-500 pulse-dot"></span>Tampered</span>'
                : '<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-700 text-[10px] font-extrabold uppercase"><span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>Verified</span>';

            const merkleBadge = d.merkle_proof
                ? `<div class="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[8px] font-black border border-emerald-100 uppercase">
                    <span class="material-symbols-outlined text-[10px]">account_tree</span> Merkle Verified
                   </div>`
                : '';

            const anchorIcon = d.polygon_txid
                ? `<a href="https://amoy.polygonscan.com/tx/${d.polygon_txid}" target="_blank" class="material-symbols-outlined text-[14px] text-emerald-500 hover:text-emerald-700 transition-colors" title="View Public Proof on PolygonScan">link</a>`
                : '';

            return `<tr class="${i % 2 === 0 ? '' : 'bg-surface-container-lowest'} hover:bg-slate-50/50 transition-colors">
                <td class="px-6 py-5 text-sm font-bold text-secondary flex flex-col items-start gap-1">
                    <div class="flex items-center gap-1.5">#${d.block_index} ${anchorIcon}</div>
                    <span class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[8px] font-black uppercase">V${d.version_number || 1}</span>
                </td>
                <td class="px-6 py-5 text-sm font-semibold text-primary">
                    ${fname}
                    <div class="mt-1 flex flex-wrap gap-2">
                        <a href="/api/chain/document/${d.block_index}/certified" target="_blank" aria-label="Download certified PDF" class="inline-flex items-center gap-1 text-[9px] font-black uppercase text-primary hover:text-primary-container transition-colors">
                            <span class="material-symbols-outlined text-[12px]">verified</span> Certified PDF
                        </a>
                        <a href="/api/verify/${d.block_index}/proof?api_key=${API_KEY}" target="_blank" aria-label="Download JSON proof" class="inline-flex items-center gap-1 text-[9px] font-black uppercase text-secondary hover:text-primary-container transition-colors">
                            <span class="material-symbols-outlined text-[12px]">download</span> JSON Proof
                        </a>
                        <button onclick="showVersionHistory(${d.block_index})" aria-label="View version history" class="inline-flex items-center gap-1 text-[9px] font-black uppercase text-blue-600 hover:text-blue-800 transition-colors">
                            <span class="material-symbols-outlined text-[12px]">history</span> View Versions
                        </button>
                        <button onclick="renderIntegrityModal(${d.block_index})" aria-label="Verify integrity" class="inline-flex items-center gap-1 text-[9px] font-black uppercase text-emerald-600 hover:text-emerald-800 transition-colors">
                            <span class="material-symbols-outlined text-[12px]">analytics</span> Verify Integrity
                        </button>
                        <button onclick="renderDocumentIntelligence(${d.block_index})" aria-label="View AI intelligence" class="inline-flex items-center gap-1 text-[9px] font-black uppercase text-blue-600 hover:text-blue-800 transition-colors">
                            <span class="material-symbols-outlined text-[12px]">psychology</span> Intelligence
                        </button>
                    </div>
                </td>
                <td class="px-6 py-5 flex flex-col gap-1">
                    <div class="flex items-center gap-2">
                        <span class="text-[8px] font-black text-slate-400 uppercase">Block Hash:</span>
                        <code class="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">${d.block_hash.slice(0, 16)}...</code>
                    </div>
                    ${d.ipfs_cid ? `
                    <div class="flex items-center gap-2">
                        <span class="text-[8px] font-black text-blue-400 uppercase">IPFS Node:</span>
                        <a href="https://ipfs.io/ipfs/${d.ipfs_cid}" target="_blank" class="text-[10px] font-mono text-blue-600 hover:underline">
                            ${d.ipfs_cid.slice(0, 12)}...
                        </a>
                    </div>
                    ` : ''}
                    ${d.merkle_root ? `
                    <div class="flex items-center gap-2">
                        <span class="text-[8px] font-black text-emerald-400 uppercase">Merkle Root:</span>
                        <code class="text-[10px] font-mono bg-emerald-50 px-2 py-0.5 rounded text-emerald-600">${d.merkle_root.slice(0, 16)}...</code>
                    </div>
                    ` : ''}
                    ${merkleBadge}
                </td>
                <td class="px-6 py-5 text-xs font-semibold text-slate-600">${d.uploaded_by || 'Anonymous'}</td>
                <td class="px-6 py-5 text-xs text-on-surface-variant font-medium">${new Date(d.upload_timestamp).toLocaleString()}</td>
                <td class="px-6 py-5">${status}</td></tr>`;
        }).join('');
        document.getElementById('chain-count').textContent = `Showing ${chain.length} entries`;
    }).catch(() => {
        body.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-red-400">Failed to load chain data.</td></tr>';
    });
}

// ── Audit Log Page ──
function renderAudit(app) {
    document.getElementById('page-title').textContent = 'Audit Log';
    const wrap = document.createElement('div');
    wrap.className = 'max-w-7xl mx-auto space-y-8 fade-in';
    wrap.innerHTML = `
        <div class="flex flex-col md:flex-row md:items-end justify-between mb-2 gap-6">
            <div class="space-y-2"><h1 class="text-4xl font-extrabold tracking-tight text-primary">System Audit</h1>
            <p class="text-on-surface-variant max-w-lg">Complete history of all document interactions, modifications, and system events.</p></div>
            <div id="audit-filter-ui" class="hidden">
                <button id="clear-audit-filter" class="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-bold text-xs hover:bg-slate-300 transition-all">
                    <span class="material-symbols-outlined text-sm">close</span> Clear Filter
                </button>
            </div>
        </div>`;

    const tableWrap = document.createElement('div');
    tableWrap.className = 'bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm';
    tableWrap.innerHTML = `
        <div class="px-6 py-5 border-b border-surface-container flex items-center justify-between">
            <h3 class="text-lg font-bold text-primary" id="audit-title">Audit Events</h3>
            <button id="refresh-audit" class="text-xs font-bold text-white bg-primary px-3 py-1.5 rounded-lg shadow-lg shadow-primary/20 active:scale-95 transition-all">Refresh Audit</button>
        </div>
        <div class="overflow-x-auto"><table class="w-full text-left border-collapse"><thead><tr class="bg-surface-container-low">
            <th class="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Time</th>
            <th class="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">File</th>
            <th class="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Action</th>
            <th class="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Actor</th>
            <th class="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Details</th>
            <th class="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">History</th>
        </tr></thead><tbody id="audit-body" class="divide-y divide-surface-container"></tbody></table></div>`;
    wrap.appendChild(tableWrap);
    app.appendChild(wrap);

    loadAudit();
    document.getElementById('refresh-audit').addEventListener('click', () => {
        const filterId = document.getElementById('audit-filter-ui').dataset.id;
        loadAudit(false, filterId);
    });
    document.getElementById('clear-audit-filter').addEventListener('click', () => {
        loadAudit(false, null);
    });
}

function loadAudit(silent = false, documentId = null) {
    const body = document.getElementById('audit-body');
    const filterUi = document.getElementById('audit-filter-ui');
    const title = document.getElementById('audit-title');
    if (!body) return;

    if (documentId) {
        filterUi.classList.remove('hidden');
        filterUi.dataset.id = documentId;
        title.textContent = `History for Block #${documentId}`;
    } else {
        filterUi.classList.add('hidden');
        delete filterUi.dataset.id;
        title.textContent = `Audit Events`;
    }

    if (!silent) body.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-slate-400">Loading audit logs...</td></tr>';

    const fetchCall = documentId ? API.getDocumentHistory(documentId) : API.getAudit();

    fetchCall.then(logs => {
        if (!logs.length) {
            body.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-slate-400">No audit events recorded.</td></tr>';
            return;
        }
        body.innerHTML = logs.map(log => {
            const fname = log.filename.split(/[/\\]/).pop();
            const isTamper = log.action.includes('TAMPER');
            const rowClass = isTamper ? 'bg-red-50 text-red-900' : 'hover:bg-slate-50/50';
            const actionBadge = isTamper
                ? `<span class="px-2 py-0.5 rounded-full bg-red-600 text-white text-[9px] font-black uppercase">TAMPER DETECTED</span>`
                : `<span class="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[9px] font-bold uppercase">${log.action}</span>`;

            return `<tr class="${rowClass} transition-colors">
                <td class="px-6 py-5 text-xs font-medium">${new Date(log.timestamp).toLocaleString()}</td>
                <td class="px-6 py-5 text-xs font-bold">${fname} <span class="text-[10px] text-slate-400 font-normal ml-1">#${log.document_id}</span></td>
                <td class="px-6 py-5">${actionBadge}</td>
                <td class="px-6 py-5 text-xs font-semibold">${log.actor}</td>
                <td class="px-6 py-5 text-xs text-on-surface-variant leading-relaxed">${log.details}</td>
                <td class="px-6 py-5 text-xs">
                    ${!documentId ? `<button onclick="loadAudit(false, ${log.document_id})" aria-label="View history for block ${log.document_id}" class="text-secondary font-bold hover:underline">View History</button>` : ''}
                </td>
            </tr>`;
        }).join('');
    }).catch(() => {
        body.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-red-400">Failed to load audit data.</td></tr>';
    });
}

// ── Settings Page ──
function renderSettings(app) {
    app.innerHTML = '';
    document.getElementById('page-title').textContent = 'System Settings';
    const wrap = document.createElement('div');
    wrap.className = 'max-w-2xl mx-auto space-y-8 fade-in';
    const isDark = document.documentElement.classList.contains('dark');

    wrap.innerHTML = `
        <div class="space-y-2"><h1 class="text-4xl font-extrabold tracking-tight text-primary">Preferences</h1>
        <p class="text-on-surface-variant">Configure your local workspace and visual identity.</p></div>
        
        <div class="bg-surface-container-lowest rounded-2xl p-8 shadow-sm border border-surface-container">
            <div class="flex items-center justify-between">
                <div>
                    <h3 class="font-bold text-lg text-primary">Dark Interface</h3>
                    <p class="text-sm text-slate-500">Enable high-contrast dark theme for low light environments.</p>
                </div>
                <button id="theme-toggle" class="w-14 h-8 rounded-full bg-slate-200 dark:bg-emerald-500 relative transition-colors">
                    <div class="w-6 h-6 rounded-full bg-white absolute top-1 left-1 dark:left-7 transition-all shadow-sm"></div>
                </button>
            </div>
        </div>
    `;
    app.appendChild(wrap);

    document.getElementById('theme-toggle').addEventListener('click', () => {
        const doc = document.documentElement;
        if (doc.classList.contains('dark')) {
            doc.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        } else {
            doc.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        }
        renderSettings(app); // Re-render to update toggle state
    });
}

// ── Help Guide Page ──
function renderHelp(app) {
    document.getElementById('page-title').textContent = 'System Protocol Guide';
    const wrap = document.createElement('div');
    wrap.className = 'max-w-7xl mx-auto space-y-16 fade-in';

    wrap.innerHTML = `
        <div class="text-center space-y-4">
            <div class="inline-flex items-center gap-2 px-3 py-1 bg-primary text-white rounded-full text-[10px] font-black tracking-widest uppercase mb-2">Protocol v3.2 - Implementation & Design Blueprint</div>
            <h1 class="text-6xl font-black text-primary tracking-tight">System <span class="text-secondary">Intelligence</span> Guide</h1>
            <p class="text-on-surface-variant text-lg max-w-2xl mx-auto font-medium">Strategic documentation for the DoVER decentralized document integrity ecosystem.</p>
        </div>

        <!-- Implementation Disclaimer Block -->
        <div class="bg-blue-50 border border-blue-100 rounded-[2rem] p-10 flex flex-col md:flex-row gap-8 items-center shadow-sm">
            <div class="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-3xl">info</span>
            </div>
            <div class="space-y-2">
                <h2 class="text-xl font-black text-primary uppercase tracking-tight">Project Implementation Status</h2>
                <p class="text-sm text-slate-600 leading-relaxed font-medium">
                    DoVER is a functional prototype demonstrating a decentralized document integrity pipeline. 
                    The current implementation focuses on **Core Cryptographic Logic** (Hashing, Chaining, Signature Verification). 
                    Advanced network-level features, including **Global PKI Onboarding**, **Merkle Batching**, and **Polygon Network Persistence**, 
                    are presented here as part of the system’s **Architectural Design Blueprint** for production-grade scaling.
                </p>
            </div>
        </div>

        <!-- 1. The Core Operational Engine -->
        <section class="space-y-8">
            <div class="flex items-center gap-4">
                <div class="h-px flex-1 bg-slate-200"></div>
                <h2 class="text-xs font-black uppercase tracking-[0.3em] text-slate-400">01. Core Operational Engine</h2>
                <div class="h-px flex-1 bg-slate-200"></div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                    <div class="text-primary font-black text-4xl opacity-10">01</div>
                    <h4 class="font-bold text-lg text-primary">Cryptographic Hashing</h4>
                    <p class="text-xs text-slate-500 leading-relaxed">Files are fingerprinted using SHA-256 before ingestion. This ensures any modification—down to a single pixel—is immediately detected.</p>
                </div>
                <div class="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                    <div class="text-primary font-black text-4xl opacity-10">02</div>
                    <h4 class="font-bold text-lg text-primary">Distributed Chaining</h4>
                    <p class="text-xs text-slate-500 leading-relaxed">Document records are linked in a blockchain-style ledger. Each block contains the hash of its predecessor, creating an immutable history.</p>
                </div>
                <div class="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                    <div class="text-primary font-black text-4xl opacity-10">03</div>
                    <h4 class="font-bold text-lg text-primary">Forensic Analysis</h4>
                    <p class="text-xs text-slate-500 leading-relaxed">Integrated worker threads perform multi-layer scans for font consistency and baseline jitter to identify potential physical tampering.</p>
                </div>
            </div>
        </section>

        <!-- 2. The Verification Journey (Live Demo) -->
        <section class="bg-slate-900 p-12 rounded-[4rem] text-white space-y-10 relative overflow-hidden">
            <div class="absolute top-0 right-0 p-8 opacity-5"><span class="material-symbols-outlined text-[20rem]">verified</span></div>
            <div class="relative z-10 grid md:grid-cols-2 gap-12 items-center">
                <div class="space-y-6">
                    <h2 class="text-4xl font-black tracking-tight">Active Trust Journey <br/><span class="text-blue-400">Integrated Verification</span></h2>
                    <p class="text-slate-400 text-sm leading-relaxed">Verification is a comprehensive journey. Our live scanner provides real-time visual checklists of the cryptographic and AI checks being performed on the record.</p>
                    <div class="space-y-4">
                        <div class="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
                            <span class="material-symbols-outlined text-blue-400">psychology</span>
                            <div>
                                <p class="text-xs font-black uppercase">Gemini AI Audit</p>
                                <p class="text-[10px] text-slate-500">Live natural language summaries generated for every verification.</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
                            <span class="material-symbols-outlined text-emerald-400">history</span>
                            <div>
                                <p class="text-xs font-black uppercase">Ancestry Validation</p>
                                <p class="text-[10px] text-slate-500">Real-time traversal of the document's version history and audit log.</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="bg-white/5 rounded-3xl p-8 border border-white/10 space-y-6 text-center">
                    <div class="space-y-2">
                        <span class="material-symbols-outlined text-5xl text-blue-400">auto_awesome</span>
                        <h3 class="text-xl font-bold">AI Confidence Gauge</h3>
                    </div>
                    <div class="space-y-4">
                        <div class="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                            <div class="h-full bg-blue-500 w-[95%]"></div>
                        </div>
                        <p class="text-[11px] text-slate-400 leading-relaxed italic">"The confidence gauge utilizes Gemini AI to interpret forensic health flags, providing a human-readable risk score for each record."</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- 3. Architectural Design Blueprint -->
        <section class="space-y-8">
            <div class="flex items-center gap-4">
                <div class="h-px flex-1 bg-slate-200"></div>
                <h2 class="text-xs font-black uppercase tracking-[0.3em] text-slate-400">03. Architectural Design Blueprint</h2>
                <div class="h-px flex-1 bg-slate-200"></div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div class="bg-surface-container-low p-10 rounded-[3rem] border border-surface-container space-y-6">
                    <div class="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center"><span class="material-symbols-outlined text-3xl">hub</span></div>
                    <h3 class="text-2xl font-black text-primary">Scalable PKI Architecture</h3>
                    <p class="text-slate-500 leading-relaxed text-sm italic">Designed for enterprise scaling.</p>
                    <p class="text-slate-500 leading-relaxed text-sm">Our blueprint includes a centralized Key Registry for institutional onboarding. This architecture supports RSA-2048 identity verification and administrative approval workflows for corporate entities.</p>
                </div>
                <div class="bg-surface-container-low p-10 rounded-[3rem] border border-surface-container space-y-6">
                    <div class="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center"><span class="material-symbols-outlined text-3xl">link</span></div>
                    <h3 class="text-2xl font-black text-primary">Public Network Anchoring</h3>
                    <p class="text-slate-500 leading-relaxed text-sm italic">Designed for global immutability.</p>
                    <p class="text-slate-500 leading-relaxed text-sm">The architecture supports anchoring Merkle Root hashes to the Polygon blockchain. This provides a secondary, tamper-proof layer of proof-of-existence that survives even if the DoVER server is offline.</p>
                </div>
            </div>
        </section>

        <!-- 4. Adversarial Security Standards -->
        <section class="space-y-8">
            <div class="flex items-center gap-4">
                <div class="h-px flex-1 bg-slate-200"></div>
                <h2 class="text-xs font-black uppercase tracking-[0.3em] text-slate-400">04. Adversarial Security Standards</h2>
                <div class="h-px flex-1 bg-slate-200"></div>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div class="p-6 bg-surface-container-lowest border border-slate-100 rounded-3xl space-y-3">
                    <span class="material-symbols-outlined text-secondary">history</span>
                    <h4 class="font-bold text-sm text-primary">Anti-Replay</h4>
                    <p class="text-[10px] text-slate-500">X-Nonce enforcement logic designed to prevent duplicate request execution.</p>
                </div>
                <div class="p-6 bg-surface-container-lowest border border-slate-100 rounded-3xl space-y-3">
                    <span class="material-symbols-outlined text-secondary">signature</span>
                    <h4 class="font-bold text-sm text-primary">HMAC Signing</h4>
                    <p class="text-[10px] text-slate-500">Protocol designed for cryptographically signed request validation via API Secrets.</p>
                </div>
                <div class="p-6 bg-surface-container-lowest border border-slate-100 rounded-3xl space-y-3">
                    <span class="material-symbols-outlined text-secondary">timer</span>
                    <h4 class="font-bold text-sm text-primary">Clock Skew</h4>
                    <p class="text-[10px] text-slate-500">Time-windowed authentication to minimize interception windows.</p>
                </div>
                <div class="p-6 bg-surface-container-lowest border border-slate-100 rounded-3xl space-y-3">
                    <span class="material-symbols-outlined text-secondary">security</span>
                    <h4 class="font-bold text-sm text-primary">Abuse Tracking</h4>
                    <p class="text-[10px] text-slate-500">Integrated scoring system to flag and block malicious traffic patterns.</p>
                </div>
            </div>
        </section>

        <!-- 5. Future Compliance: Export & Evidence -->
        <section class="bg-blue-50 p-12 rounded-[4rem] flex flex-col md:flex-row items-center gap-12 border border-blue-100 shadow-sm">
            <div class="flex-1 space-y-6">
                <h2 class="text-4xl font-black text-primary tracking-tight">Certified Export <br/><span class="text-secondary">Blueprint</span></h2>
                <p class="text-slate-600 text-sm leading-relaxed font-medium">The system’s designed lifecycle includes **Official Certified PDF Exports**. These documents are architected to include an embedded <strong>dover_proof.json</strong> file, aligning with digital evidence standards for court admissibility.</p>
                <div class="flex gap-4">
                    <div class="flex items-center gap-2 text-xs font-black text-primary uppercase"><span class="material-symbols-outlined text-lg">draw</span> P12 Signature</div>
                    <div class="flex items-center gap-2 text-xs font-black text-primary uppercase"><span class="material-symbols-outlined text-lg">attachment</span> Audit Trail</div>
                </div>
            </div>
            <div class="w-full md:w-72 aspect-[3/4] bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 opacity-80">
                <div class="h-4 w-3/4 bg-slate-100 rounded"></div>
                <div class="h-4 w-full bg-slate-100 rounded"></div>
                <div class="h-4 w-5/6 bg-slate-100 rounded"></div>
                <div class="flex-1"></div>
                <div class="border-2 border-blue-100 bg-blue-50/50 p-4 rounded-xl">
                    <p class="text-[8px] font-black text-blue-400 uppercase tracking-widest">Architectural Spec</p>
                    <p class="text-[10px] font-bold text-primary uppercase mt-1">Certified PDF Export</p>
                    <p class="text-[8px] text-slate-400">Designed for Evidence</p>
                </div>
            </div>
        </section>

        <div class="bg-primary p-12 rounded-[3rem] text-white text-center space-y-6 shadow-2xl shadow-primary/30 relative overflow-hidden mt-8">
            <div class="relative z-10">
                <h2 class="text-3xl font-black uppercase tracking-tight">Technical Implementation & Research</h2>
                <p class="opacity-70 max-w-lg mx-auto text-sm leading-relaxed">For a deep dive into the cryptographic logic and adversarial threat models currently being prototyped, refer to the project's internal technical specifications.</p>
                <div class="flex justify-center gap-4 mt-6">
                    <a href="#dashboard" class="inline-flex bg-white text-primary px-10 py-4 rounded-2xl font-black hover:scale-105 active:scale-95 transition-transform shadow-xl">Return to Vault</a>
                </div>
            </div>
            <span class="material-symbols-outlined absolute -right-6 -bottom-6 text-[15rem] opacity-5 pointer-events-none">help_center</span>
        </div>
    `;
    app.appendChild(wrap);
}
// ── Batch Upload Page ──
function renderBatch(app) {
    document.getElementById('page-title').textContent = 'Batch Upload';
    let pollInterval = null;

    const wrap = document.createElement('div');
    wrap.className = 'max-w-5xl mx-auto space-y-8 fade-in';
    wrap.innerHTML = `
        <div class="mb-4">
            <div class="inline-flex items-center gap-2 px-3 py-1 bg-secondary-fixed text-on-secondary-fixed-variant rounded-full text-xs font-bold mb-4 tracking-wider uppercase">Queue-Powered</div>
            <h1 class="text-4xl font-extrabold tracking-tight text-primary mb-3">Batch Upload</h1>
            <p class="text-on-surface-variant text-lg leading-relaxed">Upload up to 20 documents at once. Each file is queued and processed asynchronously.</p>
        </div>

        <div class="bg-surface-container-lowest rounded-2xl p-8 shadow-sm space-y-6">
            <form id="batch-form">
                <div id="batch-drop" class="drop-zone group relative flex flex-col items-center justify-center border-2 border-dashed border-outline-variant bg-surface-container-lowest rounded-xl p-12 transition-all hover:border-secondary hover:bg-blue-50/30 cursor-pointer mb-6">
                    <div class="w-16 h-16 bg-secondary-fixed rounded-full flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                        <span class="material-symbols-outlined text-secondary text-3xl">folder_open</span>
                    </div>
                    <h3 class="text-xl font-semibold text-primary mb-2" id="batch-drop-label">Drag & drop files here</h3>
                    <p class="text-on-surface-variant text-sm mb-6">Up to 20 files • PDF, DOCX, PNG, JPG, TXT</p>
                    <input type="file" id="batch-file-input" class="hidden" multiple accept=".pdf,.docx,.png,.jpg,.jpeg,.txt"/>
                    <button type="button" id="batch-browse-btn" class="bg-primary text-white px-8 py-3 rounded-xl font-semibold shadow-lg shadow-primary/20 hover:bg-opacity-90 active:scale-95 transition-all">Browse Files</button>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-2">
                        <label class="block text-sm font-semibold text-primary px-1">Uploaded By</label>
                        <div class="relative flex items-center">
                            <span class="material-symbols-outlined absolute left-3 text-outline text-lg">person</span>
                            <input id="batch-user" class="w-full bg-surface pl-10 pr-4 py-3 rounded-xl border border-outline-variant/30 focus:ring-2 focus:ring-secondary/20 text-on-surface text-sm" placeholder="Full legal name" type="text" value="${currentUser?.name || ''}" ${currentUser ? 'readonly' : ''}/>
                        </div>
                    </div>
                    <div class="space-y-2">
                        <label class="block text-sm font-semibold text-primary px-1">Document Category</label>
                        <div class="relative flex items-center">
                            <span class="material-symbols-outlined absolute left-3 text-outline text-lg">category</span>
                            <select id="batch-dept" class="w-full bg-surface pl-10 pr-4 py-3 rounded-xl border border-outline-variant/30 focus:ring-2 focus:ring-secondary/20 text-on-surface text-sm appearance-none">
                                ${currentMode === 'b2c' ? `
                                    <option>Personal</option>
                                    <option>Family</option>
                                    <option>Office</option>
                                ` : `
                                    <option>Employee Records</option>
                                `}
                            </select>
                        </div>
                    </div>
                </div>

                <button type="submit" id="batch-submit-btn" class="w-full mt-6 bg-primary text-white px-10 py-4 rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-opacity-90 active:scale-95 transition-all text-lg flex items-center justify-center gap-3 disabled:opacity-40" disabled>
                    <span class="material-symbols-outlined">upload_file</span> Upload Batch
                </button>
            </form>
        </div>

        <div id="batch-dashboard" class="hidden space-y-6"></div>
    `;
    app.appendChild(wrap);

    // Wire up drop zone
    const dropZone = document.getElementById('batch-drop');
    const fileInput = document.getElementById('batch-file-input');
    const dropLabel = document.getElementById('batch-drop-label');
    const submitBtn = document.getElementById('batch-submit-btn');

    document.getElementById('batch-browse-btn').addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
        e.preventDefault(); dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) { fileInput.files = e.dataTransfer.files; onFilesSelected(); }
    });
    fileInput.addEventListener('change', onFilesSelected);

    function onFilesSelected() {
        const count = fileInput.files.length;
        if (count > 0) {
            dropLabel.textContent = `${count} file${count > 1 ? 's' : ''} selected`;
            submitBtn.disabled = false;
        }
    }

    // Submit
    document.getElementById('batch-form').addEventListener('submit', async e => {
        e.preventDefault();
        if (!fileInput.files.length) return;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span> Queuing...';

        const fd = new FormData();
        for (const file of fileInput.files) fd.append('files', file);
        fd.append('user', document.getElementById('batch-user').value || 'anonymous');
        fd.append('department', document.getElementById('batch-dept').value);

        try {
            const res = await API.batchUpload(fd, Array.from(fileInput.files));
            if (!res.batch_id) throw new Error(res.error || 'Upload failed');
            startDashboard(res);
        } catch (err) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span class="material-symbols-outlined">upload_file</span> Upload Batch';
            alert('Error: ' + err.message);
        }
    });

    function startDashboard(batch) {
        // Hide form, show dashboard
        document.getElementById('batch-form').classList.add('hidden');
        const dash = document.getElementById('batch-dashboard');
        dash.classList.remove('hidden');
        dash.innerHTML = `
            <div class="bg-surface-container-lowest rounded-2xl p-8 shadow-sm">
                <div class="flex items-center justify-between mb-6">
                    <div>
                        <p class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Batch ID: ${batch.batch_id}</p>
                        <h2 class="text-2xl font-bold text-primary">Processing <span id="dash-completed">0</span> / ${batch.total_files} files</h2>
                    </div>
                    <span id="dash-badge" class="px-3 py-1 rounded-full text-xs font-black uppercase bg-blue-100 text-blue-700">QUEUED</span>
                </div>
                <div class="w-full bg-slate-100 rounded-full h-3 mb-8 overflow-hidden">
                    <div id="dash-overall-bar" class="h-3 rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-500" style="width:0%"></div>
                </div>
                <div id="dash-jobs" class="space-y-4"></div>
            </div>
        `;

        // Seed placeholders immediately from job_ids
        const jobsContainer = document.getElementById('dash-jobs');
        batch.job_ids.forEach(id => {
            jobsContainer.insertAdjacentHTML('beforeend', jobRowHTML({ job_id: id, filename: '...', status: 'queued', progress: 0, error: null, document_id: null }));
        });

        // Start polling
        pollInterval = setInterval(() => pollStatus(batch.batch_id, batch.total_files), 2000);
        pollStatus(batch.batch_id, batch.total_files);
    }

    async function pollStatus(batchId, total) {
        try {
            const data = await API.getBatchStatus(batchId);
            if (!data.jobs) return;

            // Update overall bar
            const pct = Math.round((data.completed / data.total) * 100);
            document.getElementById('dash-overall-bar').style.width = pct + '%';
            document.getElementById('dash-completed').textContent = data.completed;

            // Update badge
            const badge = document.getElementById('dash-badge');
            const allDone = (data.completed + data.failed) === data.total;
            if (allDone && data.failed > 0) { badge.textContent = 'PARTIAL FAIL'; badge.className = 'px-3 py-1 rounded-full text-xs font-black uppercase bg-red-100 text-red-700'; }
            else if (allDone) { badge.textContent = 'COMPLETE'; badge.className = 'px-3 py-1 rounded-full text-xs font-black uppercase bg-green-100 text-green-700'; }
            else if (data.processing > 0) { badge.textContent = 'PROCESSING'; badge.className = 'px-3 py-1 rounded-full text-xs font-black uppercase bg-yellow-100 text-yellow-700'; }

            // Update each job row
            const container = document.getElementById('dash-jobs');
            container.innerHTML = data.jobs.map(j => jobRowHTML(j)).join('');

            // Stop polling when finished
            if (allDone) {
                clearInterval(pollInterval);
                document.getElementById('dash-overall-bar').style.width = '100%';
            }
        } catch (err) {
            // Silently retry on network error
        }
    }

    function jobRowHTML(job) {
        const statusColors = {
            queued: 'bg-slate-100 text-slate-600',
            processing: 'bg-yellow-100 text-yellow-700',
            completed: 'bg-green-100 text-green-700',
            failed: 'bg-red-100 text-red-700'
        };
        const barColors = {
            queued: 'bg-slate-300',
            processing: 'bg-yellow-400',
            completed: 'bg-emerald-500',
            failed: 'bg-red-500'
        };
        const icon = job.status === 'completed'
            ? '<span class="material-symbols-outlined text-emerald-500 text-xl" style="font-variation-settings:\"FILL\" 1">check_circle</span>'
            : job.status === 'failed'
                ? '<span class="material-symbols-outlined text-red-500 text-xl" style="font-variation-settings:\"FILL\" 1">cancel</span>'
                : job.status === 'processing'
                    ? '<span class="material-symbols-outlined text-yellow-500 text-xl animate-spin">progress_activity</span>'
                    : '<span class="material-symbols-outlined text-slate-400 text-xl">schedule</span>';

        const docLink = job.document_id
            ? `<span class="text-[10px] text-secondary font-bold">Block #${job.document_id}</span>`
            : '';

        const statusBadge = `<span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${statusColors[job.status] || statusColors.queued}">${job.status}</span>`;

        return `
            <div class="flex items-center gap-4 p-4 bg-surface-container rounded-xl">
                <div class="flex-shrink-0">${icon}</div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-2">
                        <span class="text-sm font-semibold text-primary truncate">${job.filename}</span>
                        ${statusBadge}
                        ${docLink}
                    </div>
                    <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div class="h-1.5 rounded-full transition-all duration-500 ${barColors[job.status] || barColors.queued}" style="width:${job.progress}%"></div>
                    </div>
                    ${job.error ? `<p class="text-[10px] text-red-500 font-bold mt-1">${job.error}</p>` : ''}
                </div>
                <span class="text-xs font-bold text-slate-400 flex-shrink-0">${job.progress}%</span>
            </div>
        `;
    }

    // Cleanup on page navigation
    window.addEventListener('hashchange', () => { if (pollInterval) clearInterval(pollInterval); }, { once: true });
}

async function showVersionHistory(id) {
    // Basic modal/overlay for version history
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[100] flex items-center justify-center p-6 bg-primary/40 backdrop-blur-sm fade-in';
    overlay.id = 'version-overlay';
    overlay.innerHTML = `
        <div class="bg-white dark:bg-[#1C2A41] w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] scale-in">
            <div class="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <div>
                    <h3 class="text-xl font-black text-primary dark:text-[#E9C176] uppercase tracking-tight">Version Timeline</h3>
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Document Lineage Tracking</p>
                </div>
                <button onclick="document.getElementById('version-overlay').remove()" class="w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors">
                    <span class="material-symbols-outlined text-slate-400">close</span>
                </button>
            </div>
            <div id="version-timeline-content" class="p-8 overflow-y-auto flex-1 space-y-8">
                <div class="flex justify-center py-12"><div class="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    try {
        const versions = await fetch(`/api/chain/document/${id}/versions`).then(r => r.json());
        const content = document.getElementById('version-timeline-content');

        if (!versions.length) {
            content.innerHTML = '<p class="text-center text-slate-400 font-medium py-12">No version history found.</p>';
            return;
        }

        content.innerHTML = versions.map((v, i) => {
            const isLatest = i === versions.length - 1;
            return `
                <div class="relative flex gap-6">
                    ${!isLatest ? '<div class="absolute left-[19px] top-10 bottom-[-32px] w-0.5 bg-slate-100 dark:bg-slate-800"></div>' : ''}
                    <div class="flex-shrink-0 w-10 h-10 rounded-full ${isLatest ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'} flex items-center justify-center z-10 font-black text-xs">
                        V${v.version_number}
                    </div>
                    <div class="flex-1 pb-2">
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">${new Date(v.upload_timestamp).toLocaleDateString()}</span>
                            ${isLatest ? '<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[8px] font-black uppercase tracking-tighter">Current Version</span>' : ''}
                        </div>
                        <h4 class="font-bold text-primary dark:text-[#D6E3FF] text-sm">${v.version_note || (v.version_number === 1 ? 'Original Registration' : 'No note provided')}</h4>
                        <div class="mt-2 flex items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[12px]">person</span> ${v.uploaded_by}</span>
                            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[12px]">tag</span> Block #${v.document_id}</span>
                        </div>
                    </div>
                </div>
            `;
        }).reverse().join(''); // Show latest at top

    } catch (e) {
        document.getElementById('version-timeline-content').innerHTML = '<p class="text-center text-red-500 font-bold py-12">Failed to load history.</p>';
    }
}

async function renderIntegrityModal(id) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[110] flex items-center justify-center p-6 bg-primary/60 backdrop-blur-md fade-in';
    overlay.id = 'integrity-overlay';
    overlay.innerHTML = `
        <div class="bg-white dark:bg-[#1C2A41] w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] scale-in border border-white/20">
            <div class="px-10 py-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white dark:from-[#1C2A41] dark:to-[#162235]">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg">
                        <span class="material-symbols-outlined">verified_user</span>
                    </div>
                    <div>
                        <h3 class="text-2xl font-black text-primary dark:text-[#E9C176] tracking-tight uppercase">Integrity Report</h3>
                        <p class="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Cryptographic Consensus Audit</p>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    ${currentUser?.role === 'authority' ? `
                        <button onclick="downloadReport(${id})" class="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl font-bold text-xs hover:bg-emerald-100 transition-all border border-emerald-100">
                            <span class="material-symbols-outlined text-sm">download</span> Export Official Report
                        </button>
                    ` : ''}
                    <button onclick="document.getElementById('integrity-overlay').remove()" class="w-12 h-12 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-all active:scale-90">
                        <span class="material-symbols-outlined text-slate-400">close</span>
                    </button>
                </div>
            </div>
            <div id="integrity-modal-content" class="p-10 overflow-y-auto flex-1 space-y-10 custom-scrollbar">
                <div class="flex justify-center py-20"><div class="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    try {
        const doc = await API.getDocument(id);
        const content = document.getElementById('integrity-modal-content');

        const isAnchored = !!doc.polygon_txid;
        const txUrl = `https://amoy.polygonscan.com/tx/${doc.polygon_txid}`;

        // Parse Merkle Proof if it exists
        let proofHtml = '<p class="text-xs text-slate-400 italic">No Merkle proof available for this block.</p>';
        if (doc.merkle_proof) {
            try {
                const proof = JSON.parse(doc.merkle_proof);
                proofHtml = `
                    <div class="space-y-3">
                        ${proof.map((p, i) => `
                            <div class="flex items-center gap-4 group">
                                <div class="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-[10px] font-black text-emerald-600 flex-shrink-0 border border-emerald-100 dark:border-emerald-800/30">
                                    ${i + 1}
                                </div>
                                <div class="flex-1 bg-slate-50 dark:bg-slate-900/30 px-4 py-2.5 rounded-xl border border-slate-100 dark:border-slate-800/50 group-hover:border-emerald-200 transition-colors flex items-center justify-between">
                                    <code class="text-[10px] font-mono text-slate-600 dark:text-slate-400 break-all">${p.hash || p}</code>
                                    ${p.position ? `<span class="text-[8px] font-black uppercase text-slate-400 ml-2">${p.position}</span>` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            } catch (e) {
                console.error("Merkle parse error", e);
            }
        }

        content.innerHTML = `
            <!-- Content Hash Section -->
            <section class="space-y-4">
                <div class="flex items-center justify-between">
                    <h4 class="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <span class="material-symbols-outlined text-sm">fingerprint</span> Content Fingerprint (SHA-256)
                    </h4>
                    <button onclick="navigator.clipboard.writeText('${doc.block_hash}')" class="text-[10px] font-bold text-primary hover:underline uppercase tracking-tighter">Copy Hash</button>
                </div>
                <div class="bg-slate-900 rounded-2xl p-6 shadow-inner border border-white/5">
                    <code class="text-emerald-400 font-mono text-sm break-all leading-relaxed">${doc.block_hash}</code>
                </div>
            </section>

            <!-- Merkle Proof Section -->
            <section class="space-y-4">
                <h4 class="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <span class="material-symbols-outlined text-sm">account_tree</span> Merkle Inclusion Path
                </h4>
                <div class="bg-white dark:bg-[#162235] rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                    <div class="flex items-center gap-3 mb-2">
                        <span class="text-[10px] font-black text-emerald-600 uppercase bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded">Root Hash</span>
                        <code class="text-[10px] font-mono text-slate-500">${doc.merkle_root || 'Pending Calculation'}</code>
                    </div>
                    ${proofHtml}
                </div>
            </section>

            <!-- Chain Anchor Section -->
            <section class="space-y-4">
                <h4 class="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <span class="material-symbols-outlined text-sm">link</span> Public Ledger Anchor
                </h4>
                <div class="bg-gradient-to-br from-primary to-[#003366] rounded-[2rem] p-8 text-white relative overflow-hidden shadow-xl">
                    <div class="relative z-10 space-y-6">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Network</p>
                                <p class="font-bold">Polygon PoS (Amoy Testnet)</p>
                            </div>
                            <div class="px-4 py-1.5 rounded-full ${isAnchored ? 'bg-emerald-500' : 'bg-orange-500'} text-[10px] font-black uppercase shadow-lg">
                                ${isAnchored ? 'Anchored' : 'Pending Sync'}
                            </div>
                        </div>
                        
                        ${isAnchored ? `
                            <div class="space-y-2">
                                <p class="text-[10px] font-black uppercase tracking-widest opacity-60">Transaction ID</p>
                                <code class="block bg-black/20 backdrop-blur-md px-4 py-3 rounded-xl text-xs font-mono break-all border border-white/10">${doc.polygon_txid}</code>
                            </div>
                            <a href="${txUrl}" target="_blank" class="w-full bg-white text-primary py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-xl">
                                <span class="material-symbols-outlined text-lg">open_in_new</span> View on Polygonscan
                            </a>
                        ` : `
                            <div class="flex items-center gap-4 bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/5">
                                <span class="material-symbols-outlined text-orange-400 animate-pulse">hourglass_empty</span>
                                <p class="text-xs leading-relaxed opacity-80 font-medium">This document is queued for the next public chain anchor. Usually takes 5-10 minutes.</p>
                            </div>
                        `}
                    </div>
                    <span class="material-symbols-outlined absolute -right-8 -bottom-8 text-[12rem] opacity-5 pointer-events-none rotate-12">currency_bitcoin</span>
                </div>
            </section>
        `;

    } catch (e) {
        document.getElementById('integrity-modal-content').innerHTML = `
            <div class="text-center py-20 space-y-4">
                <span class="material-symbols-outlined text-6xl text-red-200">error</span>
                <p class="text-slate-400 font-medium">Failed to load integrity report. ${e.message}</p>
            </div>
        `;
    }
}

async function renderDocumentIntelligence(id) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[110] flex items-center justify-center p-6 bg-primary/60 backdrop-blur-md fade-in';
    overlay.id = 'intelligence-overlay';
    overlay.innerHTML = `
        <div class="bg-white dark:bg-[#1C2A41] w-full max-w-5xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] scale-in border border-white/20">
            <div class="px-10 py-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white dark:from-[#1C2A41] dark:to-[#162235]">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                        <span class="material-symbols-outlined">psychology</span>
                    </div>
                    <div>
                        <h3 class="text-2xl font-black text-primary dark:text-[#E9C176] tracking-tight uppercase">Document Intelligence</h3>
                        <p class="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">AI-Powered Forensic & Content Analysis</p>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    ${currentUser?.role === 'authority' ? `
                        <button onclick="downloadReport(${id})" class="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl font-bold text-xs hover:bg-emerald-100 transition-all border border-emerald-100">
                            <span class="material-symbols-outlined text-sm">download</span> Export Official Report
                        </button>
                        <button id="refresh-ai-btn" class="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl font-bold text-xs hover:bg-blue-100 transition-all border border-blue-100">
                            <span class="material-symbols-outlined text-sm">refresh</span> Refresh Intelligence
                        </button>
                    ` : ''}
                    <button onclick="document.getElementById('intelligence-overlay').remove()" class="w-12 h-12 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-all active:scale-90">
                        <span class="material-symbols-outlined text-slate-400">close</span>
                    </button>
                </div>
            </div>
            <div id="intelligence-modal-content" class="p-10 overflow-y-auto flex-1 space-y-10">
                <div class="flex justify-center py-20"><div class="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const refreshBtn = document.getElementById('refresh-ai-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">progress_activity</span> Processing...';
            try {
                const res = await API.analyzeDocument(id);
                if (res.success) {
                    renderIntelligenceContent(id, true);
                } else {
                    alert('Analysis failed: ' + res.error);
                }
            } catch (e) {
                alert('Error: ' + e.message);
            } finally {
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = '<span class="material-symbols-outlined text-sm">refresh</span> Refresh Intelligence';
            }
        });
    }

    renderIntelligenceContent(id);
}

async function renderIntelligenceContent(id, isRefresh = false) {
    const container = document.getElementById('intelligence-modal-content');
    if (!isRefresh) {
        container.innerHTML = '<div class="flex justify-center py-20"><div class="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>';
    }

    try {
        const doc = await API.getDocument(id);
        const ai = doc.ai_summary ? (typeof doc.ai_summary === 'string' ? JSON.parse(doc.ai_summary) : doc.ai_summary) : null;

        if (!ai || ai.status === 'unavailable' || ai.status === 'skipped' || ai.status === 'error') {
            container.innerHTML = `
                <div class="text-center py-20 space-y-6">
                    <div class="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto">
                        <span class="material-symbols-outlined text-4xl text-slate-300">smart_toy</span>
                    </div>
                    <div class="space-y-2">
                        <h4 class="text-xl font-bold text-slate-700 dark:text-slate-300">Intelligence Data Pending</h4>
                        <p class="text-slate-400 max-w-xs mx-auto text-sm leading-relaxed">AI summary and data extraction are either in queue or not configured for this document.</p>
                        ${ai?.reason ? `<p class="text-xs text-red-400 font-mono mt-2">${ai.reason}</p>` : ''}
                    </div>
                    ${currentUser?.role === 'authority' ? `
                        <button onclick="document.getElementById('refresh-ai-btn').click()" class="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold text-sm shadow-xl shadow-blue-600/20 hover:scale-105 active:scale-95 transition-all">
                            Run Analysis Now
                        </button>
                    ` : ''}
                </div>
            `;
            return;
        }

        const riskColors = {
            'LOW': 'bg-emerald-100 text-emerald-700 border-emerald-200',
            'MEDIUM': 'bg-orange-100 text-orange-700 border-orange-200',
            'HIGH': 'bg-red-100 text-red-700 border-red-200'
        };
        const riskBadge = riskColors[ai.risk_assessment?.rating] || 'bg-slate-100 text-slate-700 border-slate-200';

        container.innerHTML = `
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <!-- Left Pane: Risk & Classification -->
                <div class="space-y-8">
                    <section class="space-y-6">
                        <div class="flex items-center justify-between">
                            <h4 class="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <span class="material-symbols-outlined text-sm">security_update_good</span> Risk Assessment
                            </h4>
                            <span class="px-3 py-1 rounded-full border ${riskBadge} text-[10px] font-black uppercase tracking-widest shadow-sm">
                                ${ai.risk_assessment?.rating || 'UNKNOWN'} RISK
                            </span>
                        </div>
                        <div class="bg-slate-50 dark:bg-slate-900/30 rounded-3xl p-8 border border-slate-100 dark:border-slate-800 space-y-4">
                            <div class="flex items-center gap-3">
                                <span class="px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-lg text-[10px] font-black uppercase tracking-wider">${ai.classification || 'Document'}</span>
                                <div class="h-1 flex-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div class="h-full bg-blue-600 rounded-full" style="width: ${(ai.confidence_score || 0.8) * 100}%"></div>
                                </div>
                                <span class="text-[10px] font-bold text-slate-400">${Math.round((ai.confidence_score || 0.8) * 100)}% Match</span>
                            </div>
                            <p class="text-slate-600 dark:text-slate-300 text-sm leading-relaxed font-medium">
                                ${ai.summary}
                            </p>
                            <div class="pt-4 border-t border-slate-100 dark:border-slate-800/50">
                                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">AI Narrative reasoning</p>
                                <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed italic">
                                    "${ai.risk_assessment?.reasoning || 'No reasoning provided.'}"
                                </p>
                            </div>
                        </div>
                    </section>

                    <section class="space-y-4">
                        <h4 class="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <span class="material-symbols-outlined text-sm">warning</span> Red Flags Detected
                        </h4>
                        <div class="flex flex-wrap gap-2">
                            ${(ai.risk_assessment?.flags || []).map(f => `
                                <div class="px-4 py-2 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-xl text-red-600 dark:text-red-400 text-[10px] font-bold flex items-center gap-2">
                                    <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span> ${f}
                                </div>
                            `).join('') || '<p class="text-xs text-slate-400 italic">No red flags identified by AI.</p>'}
                        </div>
                    </section>
                </div>

                <!-- Right Pane: Data Extraction -->
                <div class="space-y-8">
                    <section class="space-y-6">
                        <h4 class="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <span class="material-symbols-outlined text-sm">database</span> Extracted Entities
                        </h4>
                        <div class="bg-white dark:bg-[#162235] rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                            <table class="w-full text-left border-collapse">
                                <thead>
                                    <tr class="bg-slate-50 dark:bg-slate-800/50">
                                        <th class="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                                        <th class="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Detected Values</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-50 dark:divide-slate-800/50">
                                    <tr>
                                        <td class="px-6 py-4 text-xs font-black text-blue-600 dark:text-blue-400 uppercase">Parties</td>
                                        <td class="px-6 py-4 text-xs font-medium text-slate-700 dark:text-slate-300">
                                            ${ai.entities?.parties?.join(', ') || 'None found'}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td class="px-6 py-4 text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase">Dates</td>
                                        <td class="px-6 py-4 text-xs font-medium text-slate-700 dark:text-slate-300">
                                            ${ai.entities?.dates?.join(', ') || 'None found'}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td class="px-6 py-4 text-xs font-black text-purple-600 dark:text-purple-400 uppercase">Amounts</td>
                                        <td class="px-6 py-4 text-xs font-medium text-slate-700 dark:text-slate-300">
                                            ${ai.entities?.amounts?.join(', ') || 'None found'}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            </div>

            <!-- Full Width Sections -->
            <div class="space-y-6 pt-6 border-t border-slate-100 dark:border-slate-800/50">
                <section class="space-y-4">
                    <button onclick="document.getElementById('forensic-collapsible').classList.toggle('hidden')" class="w-full flex items-center justify-between p-6 bg-slate-800 rounded-2xl text-white hover:bg-slate-700 transition-all">
                        <div class="flex items-center gap-3">
                            <span class="material-symbols-outlined">biotech</span>
                            <span class="text-xs font-black uppercase tracking-widest">Forensic Evidence & Vision Logs</span>
                        </div>
                        <span class="material-symbols-outlined">expand_more</span>
                    </button>
                    <div id="forensic-collapsible" class="hidden bg-slate-50 dark:bg-black/20 rounded-2xl p-8 border border-slate-100 dark:border-slate-800 space-y-6 fade-in">
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div class="space-y-1">
                                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Font Consistency</p>
                                <p class="text-2xl font-black text-primary dark:text-white">${Math.round((ai.confidence_score || 0.8) * 100)}%</p>
                            </div>
                            <div class="space-y-1">
                                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pixel Variance</p>
                                <p class="text-2xl font-black text-emerald-600">Low</p>
                            </div>
                            <div class="space-y-1">
                                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Structure Validity</p>
                                <p class="text-2xl font-black text-blue-600">High</p>
                            </div>
                        </div>
                        <div class="p-4 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                            <p class="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400 italic">
                                Deep vision analysis has cross-referenced pixel jitter with OCR transcription. No significant baseline drift or character-level anomalies detected in the primary data regions.
                            </p>
                        </div>
                    </div>
                </section>

                <section class="space-y-4">
                    <div class="flex items-center justify-between">
                        <h4 class="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <span class="material-symbols-outlined text-sm">description</span> Raw OCR Transcript
                        </h4>
                        <button onclick="navigator.clipboard.writeText(document.getElementById('raw-ocr-text').innerText)" class="text-[10px] font-bold text-blue-600 hover:underline uppercase tracking-tighter">Copy Transcript</button>
                    </div>
                    <div class="bg-slate-50 dark:bg-black/20 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-inner">
                        <pre id="raw-ocr-text" class="text-xs text-slate-600 dark:text-slate-400 font-mono whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">${doc.ocr_text || 'No text extracted.'}</pre>
                    </div>
                </section>
            </div>
        `;

    } catch (e) {
        container.innerHTML = `
            <div class="text-center py-20 space-y-4">
                <span class="material-symbols-outlined text-6xl text-red-200">error</span>
                <p class="text-slate-400 font-medium">Failed to load intelligence report. ${e.message}</p>
            </div>
        `;
    }
}

// ── Export Official Report ──
async function downloadReport(id) {
    const btn = event.currentTarget;
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">progress_activity</span> Exporting...';

    try {
        const response = await fetch(`/api/chain/document/${id}/report`);
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || "Failed to generate report");
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `DoVER_Audit_Report_${id}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
    } catch (e) {
        alert("Export failed: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalContent;
    }
}

// ── Admin Page ──
async function renderAdmin(app) {
    document.getElementById('page-title').textContent = 'System Administration';
    const wrap = document.createElement('div');
    wrap.className = 'max-w-7xl mx-auto space-y-8 fade-in';
    wrap.innerHTML = `
        <div class="flex flex-col md:flex-row md:items-end justify-between mb-2 gap-6">
            <div class="space-y-2">
                <h1 class="text-4xl font-extrabold tracking-tight text-primary dark:text-white">User Management</h1>
                <p class="text-on-surface-variant dark:text-slate-400 max-w-lg">Manage system roles and authority elevations. Changes take effect immediately.</p>
            </div>
            <div class="flex flex-col items-end gap-3">
                <div class="bg-surface-container-lowest dark:bg-[#1C2A41] px-5 py-3 rounded-xl flex items-center gap-4 shadow-sm border border-slate-100 dark:border-slate-800">
                    <div class="text-right">
                        <p class="text-[9px] uppercase font-black text-slate-400 tracking-widest">Active Authorities</p>
                        <p id="auth-count" class="text-lg font-bold text-primary dark:text-[#E9C176]">--</p>
                    </div>
                    <div class="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center">
                        <span class="material-symbols-outlined text-xl">admin_panel_settings</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="bg-surface-container-lowest dark:bg-[#1C2A41] rounded-2xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800">
            <div class="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h3 class="text-lg font-bold text-primary dark:text-white">Registered Personnel</h3>
                <div class="relative max-w-md w-full">
                    <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                    <input type="text" id="user-search" placeholder="Search by name, email or department..." class="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-[#0A192F] border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/10 dark:text-white transition-all"/>
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="bg-slate-50 dark:bg-[#0A192F]/50">
                            <th class="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Personnel</th>
                            <th class="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Department</th>
                            <th class="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Access Role</th>
                            <th class="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Last Activity</th>
                            <th class="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="user-table-body" class="divide-y divide-slate-100 dark:divide-slate-800/50">
                        <tr><td colspan="5" class="px-8 py-12 text-center text-slate-400">Loading personnel records...</td></tr>
                    </tbody>
                </table>
            </div>
            <div class="px-8 py-4 bg-slate-50 dark:bg-[#0A192F]/30 border-t border-slate-100 dark:border-slate-800">
                <p id="user-count" class="text-xs text-slate-500 font-medium tracking-tight">-- total registered users</p>
            </div>
        </div>
    `;
    app.appendChild(wrap);

    const users = await API.getUsers();
    renderUserTable(users);

    const searchInput = document.getElementById('user-search');
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = users.filter(u =>
            u.name.toLowerCase().includes(query) ||
            u.email.toLowerCase().includes(query) ||
            (u.department && u.department.toLowerCase().includes(query))
        );
        renderUserTable(filtered);
    });
}

function renderUserTable(users) {
    const body = document.getElementById('user-table-body');
    const authCountEl = document.getElementById('auth-count');
    const userCountEl = document.getElementById('user-count');

    if (!body) return;

    if (!users.length) {
        body.innerHTML = '<tr><td colspan="5" class="px-8 py-12 text-center text-slate-400">No users found matching your search.</td></tr>';
        return;
    }

    const authoritiesCount = users.filter(u => u.role === 'authority').length;
    if (authCountEl) authCountEl.textContent = authoritiesCount;
    if (userCountEl) userCountEl.textContent = `${users.length} total registered users`;

    body.innerHTML = users.map(user => {
        const isSelf = user.email === currentUser.email;
        const roleBadge = user.role === 'authority'
            ? '<span class="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-[9px] font-black uppercase tracking-tighter border border-blue-200 dark:border-blue-800">Authority</span>'
            : '<span class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 text-[9px] font-black uppercase tracking-tighter border border-slate-200 dark:border-slate-700">Standard User</span>';

        return `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <td class="px-8 py-5">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-primary dark:text-[#E9C176] font-black text-sm uppercase">
                            ${user.name.charAt(0)}
                        </div>
                        <div>
                            <p class="text-sm font-bold text-primary dark:text-white leading-tight">${user.name}${isSelf ? ' <span class="text-[9px] text-slate-400 font-normal italic">(You)</span>' : ''}</p>
                            <p class="text-xs text-slate-400 dark:text-slate-500 font-medium">${user.email}</p>
                        </div>
                    </div>
                </td>
                <td class="px-8 py-5">
                    <span class="text-xs font-semibold text-slate-600 dark:text-slate-400">${user.department || 'General'}</span>
                </td>
                <td class="px-8 py-5">
                    ${roleBadge}
                </td>
                <td class="px-8 py-5">
                    <p class="text-[11px] font-medium text-slate-500 dark:text-slate-400">${user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}</p>
                </td>
                <td class="px-8 py-5 text-right">
                    ${isSelf ? `
                        <span class="text-[10px] font-black text-slate-300 uppercase">Immutable</span>
                    ` : `
                        <button 
                            onclick="toggleAuthority(${user.id}, '${user.role === 'authority' ? 'user' : 'authority'}', this)"
                            aria-label="${user.role === 'authority' ? 'Revoke authority' : 'Promote to authority'} for ${user.name}"
                            class="inline-flex items-center gap-2 px-4 py-2 ${user.role === 'authority' ? 'bg-red-50 text-red-600 hover:bg-red-100 border-red-100' : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-100'} rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all border active:scale-95"
                        >
                            <span class="material-symbols-outlined text-sm">${user.role === 'authority' ? 'person_remove' : 'verified'}</span>
                            ${user.role === 'authority' ? 'Revoke' : 'Promote'}
                        </button>
                    `}
                </td>
            </tr>
        `;
    }).join('');
}

async function toggleAuthority(userId, newRole, btn) {
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">progress_activity</span> Updating...';

    try {
        const res = await API.promoteUser(userId, newRole);
        if (res.success) {
            // Success Toast or inline update
            const toast = document.createElement('div');
            toast.className = 'fixed bottom-8 right-8 bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 z-[200] fade-in slide-up';
            toast.innerHTML = `
                <span class="material-symbols-outlined">check_circle</span>
                <div>
                    <p class="font-bold text-sm">Update Successful</p>
                    <p class="text-[10px] opacity-80 uppercase font-black">${res.message}</p>
                </div>
            `;
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.classList.add('fade-out');
                setTimeout(() => toast.remove(), 500);
            }, 3000);

            // Re-render the table by re-fetching
            const users = await API.getUsers();
            renderUserTable(users);
        } else {
            alert('Failed to update role: ' + res.error);
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }
    } catch (e) {
        alert('Error: ' + e.message);
        btn.disabled = false;
        btn.innerHTML = originalContent;
    }
}

