// ── API Configuration ──
const API_KEY = 'dover_secret_key_2026';

// ── API helpers ──
const API = {
    async getStats() { return (await fetch('/api/stats')).json(); },
    async getChain() { return (await fetch('/api/chain')).json(); },
    async upload(formData) {
        return (await fetch('/api/upload', { 
            method: 'POST', 
            headers: { 'x-api-key': API_KEY },
            body: formData 
        })).json();
    },
    async verify(formData) {
        return (await fetch('/api/verify', { 
            method: 'POST', 
            headers: { 'x-api-key': API_KEY },
            body: formData 
        })).json();
    },
    async getAudit() { return (await fetch('/api/chain/audit')).json(); },
    async getMe() {
        const r = await fetch('/auth/me');
        if (r.status === 401) return null;
        return r.json();
    },
    async getDocumentHistory(id) { return (await fetch(`/api/chain/document/${id}/history`)).json(); },
    async batchUpload(formData) {
        return (await fetch('/api/upload/batch-upload', { 
            method: 'POST', 
            headers: { 'x-api-key': API_KEY },
            body: formData 
        })).json();
    },
    async getBatchStatus(batchId) {
        return (await fetch(`/api/chain/batch/${batchId}/status`)).json();
    }
};

// ── Auth State ──
let currentUser = null;

async function checkAuth() {
    currentUser = await API.getMe();
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
        navigate();
    }
}

function renderLogin(container) {
    container.innerHTML = `
        <div class="min-h-[80vh] flex items-center justify-center fade-in">
            <div class="bg-white dark:bg-[#1C2A41] p-12 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-md w-full text-center space-y-8">
                <div class="flex flex-col items-center gap-4">
                    <div class="w-20 h-20 bg-gradient-to-br from-[#001e40] to-[#0059bb] rounded-2xl flex items-center justify-center text-white shadow-xl">
                        <span class="material-symbols-outlined text-5xl" style="font-variation-settings:'FILL' 1;">verified_user</span>
                    </div>
                    <div>
                        <h1 class="text-3xl font-black text-primary dark:text-[#E9C176] tracking-tighter">DoVER</h1>
                        <p class="text-xs uppercase tracking-widest text-slate-500 dark:text-[#D6E3FF]/60 font-black">Official Vault Portal</p>
                    </div>
                </div>

                <div class="space-y-4">
                    <h2 class="text-xl font-bold text-slate-700 dark:text-[#D6E3FF]">Authentication Required</h2>
                    <p class="text-sm text-slate-500 dark:text-slate-400">Access to the decentralized registry is restricted to authorized personnel.</p>
                </div>

                <button onclick="window.location='/auth/google'" class="w-full flex items-center justify-center gap-3 bg-white dark:bg-[#0F1B33] border border-slate-300 dark:border-slate-600 py-3.5 rounded-xl font-bold text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-[0.98] shadow-sm">
                    <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" class="w-5 h-5" alt="Google"/>
                    Sign in with Google
                </button>
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
                <h2 id="page-title" class="font-sans tracking-tight text-slate-500 dark:text-[#D6E3FF] font-medium text-sm">Welcome back, ${user.name.split(' ')[0]}</h2>
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
            <a href="/auth/logout" class="flex items-center gap-2 text-slate-500 hover:text-error transition-colors text-xs font-bold uppercase tracking-wider">
                <span class="material-symbols-outlined text-lg">logout</span>
                <span class="hidden sm:inline">Logout</span>
            </a>
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
    document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.toggle('active', l.dataset.page === page);
    });
    const app = document.getElementById('app');
    app.innerHTML = '';
    switch (page) {
        case 'upload':   renderUpload(app); break;
        case 'verify':   renderVerify(app); break;
        case 'chain':    renderChain(app); break;
        case 'audit':    renderAudit(app); break;
        case 'settings': renderSettings(app); break;
        case 'help':     renderHelp(app); break;
        case 'batch':    renderBatch(app); break;
        default:         renderDashboard(app); break;
    }
}
window.addEventListener('hashchange', navigate);
window.addEventListener('DOMContentLoaded', checkAuth);
document.getElementById('menu-toggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('mobile-open');
});

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
    }).catch(() => {});
}

// ── Dashboard Page ──
function renderDashboard(app) {
    document.getElementById('page-title').textContent = 'Welcome back, Admin';
    const wrap = document.createElement('div');
    wrap.className = 'max-w-7xl mx-auto space-y-8 fade-in';

    const header = document.createElement('div');
    header.innerHTML = `<div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div><span class="text-secondary font-bold tracking-widest uppercase text-xs">Overview</span>
        <h1 class="text-3xl font-extrabold text-primary tracking-tight mt-1">Dashboard Analytics</h1></div>
        <a href="#upload" class="bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-3 rounded-xl font-semibold flex items-center gap-2 shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all">
            <span class="material-symbols-outlined text-lg">add</span> Upload New Document</a>
    </div>`;
    wrap.appendChild(header);
    renderStatsBar(wrap);

    // Chain preview
    const chainSection = document.createElement('div');
    chainSection.className = 'bg-surface-container p-8 rounded-2xl relative overflow-hidden';
    chainSection.innerHTML = `<div class="absolute top-0 right-0 p-4 opacity-5"><span class="material-symbols-outlined text-[120px]">account_tree</span></div>
        <div class="relative z-10 grid md:grid-cols-4 gap-8">
            <div class="md:col-span-1"><h3 class="text-xl font-bold text-primary mb-2">Live Node Feed</h3>
            <p class="text-xs text-slate-500 leading-relaxed">Real-time verification logs from the distributed ledger.</p></div>
            <div id="live-feed" class="md:col-span-3 flex flex-wrap gap-4">
                <div class="bg-surface-container-lowest px-4 py-3 rounded-lg border border-primary/5 flex items-center gap-3">
                    <div class="w-2 h-2 rounded-full bg-emerald-500 pulse-dot"></div>
                    <span class="text-[10px] font-mono text-slate-600">Loading chain data...</span>
                </div>
            </div>
        </div>`;
    wrap.appendChild(chainSection);
    app.appendChild(wrap);

    // Populate live feed from chain
    API.getChain().then(chain => {
        const feed = document.getElementById('live-feed');
        if (!feed) return;
        const recent = chain.slice(-3).reverse();
        feed.innerHTML = recent.map(d => `
            <div class="bg-surface-container-lowest px-4 py-3 rounded-lg border border-primary/5 flex items-center gap-3">
                <div class="w-2 h-2 rounded-full ${d.is_tampered ? 'bg-red-500' : 'bg-emerald-500'} pulse-dot"></div>
                <span class="text-[10px] font-mono text-slate-600">Block #${d.block_index} • ${d.block_hash?.slice(0,12)}...</span>
            </div>`).join('') || '<p class="text-sm text-slate-400">No blocks yet. Upload a document to begin.</p>';
    }).catch(() => {});
}

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
                        <button type="button" id="browse-btn" class="bg-gradient-to-r from-primary to-primary-container text-white px-8 py-3 rounded-xl font-semibold shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all">Browse Files</button>
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
                                <label class="block text-sm font-semibold text-primary px-1">Department</label>
                                <div class="relative flex items-center">
                                    <span class="material-symbols-outlined absolute left-3 text-outline text-lg">corporate_fare</span>
                                    <select id="upload-dept" class="w-full bg-surface pl-10 pr-4 py-3 rounded-xl border-none focus:ring-2 focus:ring-secondary/20 text-on-surface text-sm appearance-none">
                                        <option>Executive Office</option>
                                        <option>Legal & Compliance</option>
                                        <option>Operations & Logistics</option>
                                        <option>Human Resources</option>
                                        <option>Information Technology</option>
                                        <option>Strategy & Planning</option>
                                        <option>Finance & Audit</option>
                                        <option>Public Relations</option>
                                        <option>Research & Development</option>
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

                        <button type="submit" id="submit-btn" class="w-full bg-gradient-to-r from-primary to-primary-container text-white px-10 py-4 rounded-xl font-bold shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all text-lg flex items-center justify-center gap-3 disabled:opacity-50" disabled>
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
            const res = await API.upload(fd);
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
                <h4 class="text-lg font-bold text-green-900 mb-2">Document Secured</h4>
                <div class="flex items-center gap-2 mb-3">
                    <p class="text-sm text-green-800/70 text-sm">Block Index: <strong>#${res.block_index}</strong></p>
                    <span class="px-2 py-0.5 rounded bg-green-200 text-green-800 text-[10px] font-black uppercase">Version ${res.version_number || 1}</span>
                </div>
                <code class="hash-text bg-green-100 px-3 py-2 rounded block text-green-800 mb-2">${res.block_hash}</code>
                ${res.parent_document_id ? `<p class="text-[10px] font-bold text-green-600 mb-2 uppercase">Supersedes Block #${res.parent_document_id}</p>` : ''}
                ${signatureHtml}
                ${forensicHtml}
            </div>
            <div class="bg-white p-2 rounded-lg shadow-sm border border-green-100">
                <img src="${res.qr_image_base64 || ''}" class="w-32 h-32" alt="Verification QR"/>
                <p class="text-[10px] text-center mt-1 text-green-600 font-bold">SCAN TO VERIFY</p>
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
                        <button type="submit" id="verify-btn" class="w-full h-14 bg-gradient-to-r from-primary to-primary-container text-white rounded-xl font-bold text-lg flex items-center justify-center gap-3 shadow-lg shadow-primary/20 hover:opacity-90 active:scale-[0.98] transition-all">                            <span>Verify Authenticity</span><span class="material-symbols-outlined">shield_with_heart</span>
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
    }).catch(() => {});

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
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span> Verifying...';
        const fd = new FormData();
        const docId = document.getElementById('verify-id').value.trim();
        const compareWith = document.getElementById('verify-compare')?.value.trim();
        if (docId) fd.append('document_id', docId);
        if (verifyFile.files.length) fd.append('file', verifyFile.files[0]);
        if (compareWith) fd.append('compare_with', compareWith);
        try {
            const res = await API.verify(fd);
            const r = document.getElementById('verify-result');
            r.classList.remove('hidden');

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

            if (res.valid) {
                r.innerHTML = `<div class="result-card bg-green-50/50 border border-green-200 rounded-xl p-6 relative overflow-hidden fade-in">
                    <div class="flex items-center gap-3 mb-4"><span class="material-symbols-outlined text-green-600">verified</span><span class="text-xs font-bold text-green-700 uppercase tracking-widest">Status: Valid</span></div>
                    ${sigBadge}
                    <h4 class="text-lg font-bold text-green-900 mb-2">Original Document</h4>
                    <p class="text-[10px] font-black text-emerald-600 uppercase mb-2">Compared against: ${res.uploaded_by || 'Unknown'}'s upload from ${res.upload_timestamp ? new Date(res.upload_timestamp).toLocaleDateString() : 'Original Date'}</p>
                    <p class="text-sm text-green-800/70 leading-relaxed">Hash matches the registry record.</p>
                    <code class="hash-text bg-green-100 px-3 py-2 rounded block mt-3 text-green-800 mb-4">${res.file_hash || 'Verified'}</code>
                    ${res.merkle_root ? `<div class="mb-4 text-[10px] text-slate-500 font-mono bg-slate-50 p-2 rounded border border-slate-100">
                        <span class="block font-black uppercase text-slate-400 mb-1">Merkle Root Inclusion:</span>
                        ${res.merkle_root}
                    </div>` : ''}
                    ${res.ocr_valid ? '<div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-700 text-[10px] font-extrabold uppercase"><span class="material-symbols-outlined text-xs">description</span>Text Content Verified</div>' : ''}
                </div>`;
            } else if (res.error) {
                r.innerHTML = `<div class="result-card bg-yellow-50/50 border border-yellow-200 rounded-xl p-6 fade-in">
                    <div class="flex items-center gap-3 mb-2"><span class="material-symbols-outlined text-yellow-600">search_off</span><span class="text-xs font-bold text-yellow-700 uppercase">Not Found</span></div>
                    <p class="text-sm text-yellow-800/70">${res.error}</p></div>`;
            } else {
                let ocrDisplay = '';
                if (res.ocr_change_detected) {
                    ocrDisplay = `
                        <div class="mt-6 p-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800/30 rounded-xl">
                            <div class="flex items-center gap-2 mb-3 text-orange-700 dark:text-orange-400 font-bold text-xs uppercase tracking-wider">
                                <span class="material-symbols-outlined text-sm">warning</span> Text Content Change Detected via OCR
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div class="bg-white dark:bg-slate-900/50 p-3 rounded border border-orange-100 dark:border-orange-800/20">
                                    <p class="text-[9px] font-black text-slate-400 uppercase mb-2">Stored Registry Content</p>
                                    <pre class="text-[10px] text-slate-600 dark:text-slate-400 whitespace-pre-wrap font-mono leading-relaxed">${res.stored_ocr_text || 'None'}</pre>
                                </div>
                                <div class="bg-orange-100/50 dark:bg-orange-900/20 p-3 rounded border border-orange-200 dark:border-orange-800/20">
                                    <p class="text-[9px] font-black text-orange-600 dark:text-orange-400 uppercase mb-2">Current File Content</p>
                                    <pre class="text-[10px] text-orange-900 dark:text-orange-200 whitespace-pre-wrap font-mono leading-relaxed font-bold">${res.ocr_text || 'None'}</pre>
                                </div>
                            </div>
                        </div>
                    `;
                }

                let forensicDiff = '';
                if (res.forensic_comparison) {
                    const fc = res.forensic_comparison;
                    forensicDiff = `
                        <div class="mt-4 p-4 bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                            <div class="flex items-center gap-2 mb-2 text-slate-700 dark:text-slate-300 font-bold text-xs uppercase">
                                <span class="material-symbols-outlined text-sm">analytics</span> Forensic Technical Comparison
                            </div>
                            <div class="flex gap-4 text-[10px] font-medium text-slate-500">
                                <span>Font Score Diff: <strong class="${fc.font_diff>10?'text-orange-500':''}">${fc.font_diff}</strong></span>
                                <span>Alignment Score Diff: <strong class="${fc.align_diff>10?'text-orange-500':''}">${fc.align_diff}</strong></span>
                            </div>
                            ${fc.new_flags.length ? `<p class="text-[9px] mt-2 text-red-500 font-bold uppercase">New Forensic Flags Detected: ${fc.new_flags.join(', ')}</p>` : ''}
                        </div>
                    `;
                }

                let signatureDiff = '';
                if (res.signature_comparison) {
                    const sc = res.signature_comparison;
                    if (sc.status_change) {
                        signatureDiff = `
                            <div class="mt-4 p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-200 dark:border-emerald-800/30">
                                <div class="flex items-center gap-2 mb-2 text-emerald-700 dark:text-emerald-400 font-bold text-xs uppercase">
                                    <span class="material-symbols-outlined text-sm">history_edu</span> Authorization Status Mismatch
                                </div>
                                <div class="text-[10px] text-emerald-800 dark:text-emerald-300">
                                    <p>Registry: <strong>${sc.original_had_signature?'Signed':'No Signature'}</strong> | <strong>${sc.original_had_seal?'Sealed':'No Seal'}</strong></p>
                                    <p>Current: <strong>${sc.current_has_signature?'Signed':'No Signature'}</strong> | <strong>${sc.current_has_seal?'Sealed':'No Seal'}</strong></p>
                                </div>
                            </div>
                        `;
                    }
                }

                const reasons = res.tamper_reasons ? res.tamper_reasons.map(r => `<li class="flex items-center gap-2 text-red-800/80"><span class="w-1.5 h-1.5 rounded-full bg-red-400"></span> ${r}</li>`).join('') : '';
                const blockId = res.document_id || res.block_index || 'N/A';

                r.innerHTML = `<div class="result-card bg-red-50/50 border border-red-200 rounded-xl p-6 relative overflow-hidden fade-in">
                    <div class="flex items-center gap-3 mb-4"><span class="material-symbols-outlined text-red-600">error</span><span class="text-xs font-bold text-red-700 uppercase tracking-widest">Status: Tampered</span></div>
                    ${sigBadge}
                    <h4 class="text-lg font-bold text-red-900 mb-2">Deep Verification Failed</h4>
                    <p class="text-[10px] font-black text-red-600 uppercase mb-2">Reference: Block #${blockId}</p>
                    <p class="text-sm text-red-800/70 leading-relaxed mb-4">System has detected unauthorized modifications via multi-layered analysis.</p>
                    
                    ${reasons ? `<div class="bg-white/50 p-4 rounded-lg border border-red-100 mb-4">
                        <p class="text-[9px] font-black text-red-400 uppercase mb-2">Tamper Reasons Identified:</p>
                        <ul class="space-y-1 text-xs">${reasons}</ul>
                    </div>` : ''}

                    ${ocrDisplay}
                    ${forensicDiff}
                    ${signatureDiff}
                </div>`;
            }
        } catch (err) {
            const r = document.getElementById('verify-result'); r.classList.remove('hidden');
            r.innerHTML = `<div class="bg-red-50 border border-red-200 rounded-xl p-6 fade-in"><p class="text-red-700 text-sm">Network error.</p></div>`;
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

            return `<tr class="${i%2===0?'':'bg-surface-container-lowest'} hover:bg-slate-50/50 transition-colors">
                <td class="px-6 py-5 text-sm font-bold text-secondary flex flex-col items-start gap-1">
                    #${d.block_index}
                    <span class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[8px] font-black uppercase">V${d.version_number || 1}</span>
                </td>
                <td class="px-6 py-5 text-sm font-semibold text-primary">
                    ${fname}
                    <div class="mt-1 flex flex-wrap gap-2">
                        <a href="/api/verify/${d.block_index}/proof?api_key=${API_KEY}" target="_blank" class="inline-flex items-center gap-1 text-[9px] font-black uppercase text-secondary hover:text-primary-container transition-colors">
                            <span class="material-symbols-outlined text-[12px]">download</span> Download Proof
                        </a>
                        <button onclick="showVersionHistory(${d.block_index})" class="inline-flex items-center gap-1 text-[9px] font-black uppercase text-blue-600 hover:text-blue-800 transition-colors">
                            <span class="material-symbols-outlined text-[12px]">history</span> View Versions
                        </button>
                    </div>
                </td>
                <td class="px-6 py-5 flex flex-col gap-1">
                    <div class="flex items-center gap-2">
                        <span class="text-[8px] font-black text-slate-400 uppercase">Block Hash:</span>
                        <code class="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">${d.block_hash.slice(0,16)}...</code>
                    </div>
                    ${d.merkle_root ? `
                    <div class="flex items-center gap-2">
                        <span class="text-[8px] font-black text-emerald-400 uppercase">Merkle Root:</span>
                        <code class="text-[10px] font-mono bg-emerald-50 px-2 py-0.5 rounded text-emerald-600">${d.merkle_root.slice(0,16)}...</code>
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
                    ${!documentId ? `<button onclick="loadAudit(false, ${log.document_id})" class="text-secondary font-bold hover:underline">View History</button>` : ''}
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
    document.getElementById('page-title').textContent = 'User Guide';
    const wrap = document.createElement('div');
    wrap.className = 'max-w-6xl mx-auto space-y-12 fade-in';
    
    wrap.innerHTML = `
        <div class="text-center space-y-4">
            <h1 class="text-5xl font-black text-primary tracking-tight">How <span class="text-secondary">DoVER</span> Works</h1>
            <p class="text-on-surface-variant text-lg">A comprehensive guide to decentralized document integrity.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div class="bg-surface-container-lowest p-8 rounded-3xl border border-surface-container shadow-sm hover:shadow-md transition-shadow space-y-4 group">
                <div class="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform"><span class="material-symbols-outlined text-3xl">upload_file</span></div>
                <h3 class="text-xl font-bold text-primary">1. Single Registration</h3>
                <p class="text-sm text-slate-500 leading-relaxed">Upload any PDF, DOCX, or Image. The system creates a unique SHA-256 fingerprint and chains it to the registry, ensuring permanent immutability.</p>
            </div>

            <div class="bg-surface-container-lowest p-8 rounded-3xl border border-surface-container shadow-sm hover:shadow-md transition-shadow space-y-4 group">
                <div class="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform"><span class="material-symbols-outlined text-3xl">folder_zip</span></div>
                <h3 class="text-xl font-bold text-primary">2. Batch Processing</h3>
                <p class="text-sm text-slate-500 leading-relaxed">Upload up to 20 documents simultaneously. The system uses a dedicated background queue to efficiently process and cryptographically seal large volumes.</p>
            </div>

            <div class="bg-surface-container-lowest p-8 rounded-3xl border border-surface-container shadow-sm hover:shadow-md transition-shadow space-y-4 group">
                <div class="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform"><span class="material-symbols-outlined text-3xl">fact_check</span></div>
                <h3 class="text-xl font-bold text-primary">3. Secure Verification</h3>
                <p class="text-sm text-slate-500 leading-relaxed">Enter a Block ID or upload a copy of the document. The system re-hashes the file and mathematically proves its authenticity against the ledger.</p>
            </div>

            <div class="bg-surface-container-lowest p-8 rounded-3xl border border-surface-container shadow-sm hover:shadow-md transition-shadow space-y-4 group">
                <div class="w-12 h-12 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform"><span class="material-symbols-outlined text-3xl">troubleshoot</span></div>
                <h3 class="text-xl font-bold text-primary">4. Deep Analysis</h3>
                <p class="text-sm text-slate-500 leading-relaxed">Our AI analyzes internal metadata, font inconsistencies, and verifies digital signatures to detect tampering, even if the file is expertly forged.</p>
            </div>

            <div class="bg-surface-container-lowest p-8 rounded-3xl border border-surface-container shadow-sm hover:shadow-md transition-shadow space-y-4 group">
                <div class="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform"><span class="material-symbols-outlined text-3xl">account_tree</span></div>
                <h3 class="text-xl font-bold text-primary">5. Chain Explorer</h3>
                <p class="text-sm text-slate-500 leading-relaxed">View the entire, unalterable block history of the registry. Monitor block generation in real-time and review the cryptographic sequence of uploads.</p>
            </div>

            <div class="bg-surface-container-lowest p-8 rounded-3xl border border-surface-container shadow-sm hover:shadow-md transition-shadow space-y-4 group">
                <div class="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform"><span class="material-symbols-outlined text-3xl">history_edu</span></div>
                <h3 class="text-xl font-bold text-primary">6. Audit Log</h3>
                <p class="text-sm text-slate-500 leading-relaxed">Every verification request, tamper alert, and system action is relentlessly logged. Review the detailed Chain of Custody for any active record.</p>
            </div>
        </div>

        <div class="bg-primary p-10 rounded-[3rem] text-white text-center space-y-6 shadow-2xl shadow-primary/30 relative overflow-hidden mt-8">
            <div class="relative z-10">
                <h2 class="text-3xl font-black">Ready to secure your first record?</h2>
                <p class="opacity-80 max-w-md mx-auto">Click the button below to head to the registration gateway.</p>
                <a href="#upload" class="inline-flex bg-white text-primary px-8 py-4 mt-2 rounded-2xl font-black hover:scale-105 active:scale-95 transition-transform">Get Started</a>
            </div>
            <span class="material-symbols-outlined absolute -right-6 -bottom-6 text-9xl opacity-10 pointer-events-none">lock</span>
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
                    <button type="button" id="batch-browse-btn" class="bg-gradient-to-r from-primary to-primary-container text-white px-8 py-3 rounded-xl font-semibold shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all">Browse Files</button>
                </div>

                <div class="space-y-2">
                    <label class="block text-sm font-semibold text-primary px-1">Uploaded By</label>
                    <div class="relative flex items-center">
                        <span class="material-symbols-outlined absolute left-3 text-outline text-lg">person</span>
                        <input id="batch-user" class="w-full bg-surface pl-10 pr-4 py-3 rounded-xl border border-outline-variant/30 focus:ring-2 focus:ring-secondary/20 text-on-surface text-sm" placeholder="Full legal name" type="text" value="${currentUser?.name || ''}" ${currentUser ? 'readonly' : ''}/>
                    </div>
                </div>

                <button type="submit" id="batch-submit-btn" class="w-full mt-6 bg-gradient-to-r from-primary to-primary-container text-white px-10 py-4 rounded-xl font-bold shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all text-lg flex items-center justify-center gap-3 disabled:opacity-40" disabled>
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

        try {
            const res = await API.batchUpload(fd);
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
            queued:     'bg-slate-100 text-slate-600',
            processing: 'bg-yellow-100 text-yellow-700',
            completed:  'bg-green-100 text-green-700',
            failed:     'bg-red-100 text-red-700'
        };
        const barColors = {
            queued:     'bg-slate-300',
            processing: 'bg-yellow-400',
            completed:  'bg-emerald-500',
            failed:     'bg-red-500'
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
