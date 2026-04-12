// ── API helpers ──
const API = {
    async getStats() { return (await fetch('/api/stats')).json(); },
    async getChain() { return (await fetch('/api/chain')).json(); },
    async upload(formData) {
        return (await fetch('/api/upload', { method: 'POST', body: formData })).json();
    },
    async verify(formData) {
        return (await fetch('/api/verify', { method: 'POST', body: formData })).json();
    },
    async getAudit() { return (await fetch('/api/chain/audit')).json(); },
    async getDocumentHistory(id) { return (await fetch(`/api/chain/document/${id}/history`)).json(); },
    async batchUpload(formData) {
        return (await fetch('/api/upload/batch-upload', { method: 'POST', body: formData })).json();
    },
    async getBatchStatus(batchId) {
        return (await fetch(`/api/chain/batch/${batchId}/status`)).json();
    }
};

// ── Router ──
function navigate() {
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
window.addEventListener('DOMContentLoaded', navigate);
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
                                    <input id="upload-user" class="w-full bg-surface pl-10 pr-4 py-3 rounded-xl border-none focus:ring-2 focus:ring-secondary/20 text-on-surface text-sm" placeholder="Full legal name" type="text"/>
                                </div>
                            </div>
                            <div class="space-y-2">
                                <label class="block text-sm font-semibold text-primary px-1">Department</label>
                                <div class="relative flex items-center">
                                    <span class="material-symbols-outlined absolute left-3 text-outline text-lg">corporate_fare</span>
                                    <select id="upload-dept" class="w-full bg-surface pl-10 pr-4 py-3 rounded-xl border-none focus:ring-2 focus:ring-secondary/20 text-on-surface text-sm appearance-none">
                                        <option>Legal & Compliance</option><option>Public Records</option><option>Financial Oversight</option><option>Administration</option>
                                    </select>
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
        try {
            const res = await API.upload(fd);
            const resultDiv = document.getElementById('upload-result');
            resultDiv.classList.remove('hidden');
            if (res.success) {
                // Forensic & Signature UI logic
                let forensicHtml = '';
                if (res.forensic_score) {
                    if (res.forensic_score.suspicious) {
                        forensicHtml = `
                            <div class="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                                <div class="flex items-center gap-2 mb-2 text-orange-700 font-bold text-xs uppercase tracking-wider">
                                    <span class="material-symbols-outlined text-sm">forensics</span> Forensic Analysis: Suspicious Document
                                </div>
                                <ul class="space-y-1">
                                    ${res.forensic_score.flags.map(f => `<li class="text-[10px] text-orange-800 flex items-center gap-1.5"><span class="w-1 h-1 rounded-full bg-orange-400"></span> ${f}</li>`).join('')}
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
                    const s = res.signature_score;
                    if (s.signature_found || s.seal_found) {
                        signatureHtml = '<div class="flex flex-wrap gap-2 mt-2">';
                        if (s.signature_found) signatureHtml += `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase"><span class="material-symbols-outlined text-[12px]">draw</span> Signature Detected</span>`;
                        if (s.seal_found) signatureHtml += `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase"><span class="material-symbols-outlined text-[12px]">approval_delegation</span> Seal Detected</span>`;
                        signatureHtml += '</div>';
                    } else {
                        signatureHtml = `<div class="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-100 text-orange-700 text-[9px] font-black uppercase"><span class="material-symbols-outlined text-[12px]">warning</span> Warning: No Signature or Seal Found</div>`;
                    }
                }

                let forensicThumbnailHtml = '';
                if (res.forensic_thumbnail) {
                    forensicThumbnailHtml = `
                        <div class="mt-4 p-3 bg-white rounded-lg border border-primary/10 shadow-sm">
                            <p class="text-[9px] font-black text-slate-400 uppercase mb-2">Forensic Highlight: Signature Area</p>
                            <img src="${res.forensic_thumbnail}" class="w-full rounded border border-red-200" alt="Signature Highlight"/>
                            <p class="text-[8px] text-center mt-1 text-red-500 font-bold">RED BOX = DETECTED HANDWRITING</p>
                        </div>
                    `;
                }

                resultDiv.innerHTML = `<div class="result-card bg-green-50/50 border border-green-200 rounded-xl p-6 relative overflow-hidden fade-in">
                    <div class="flex items-center gap-3 mb-4"><span class="material-symbols-outlined text-green-600">verified</span><span class="text-xs font-bold text-green-700 uppercase tracking-widest">Upload Successful</span></div>
                    <div class="flex flex-col md:flex-row gap-6 items-start">
                        <div class="flex-1">
                            <h4 class="text-lg font-bold text-green-900 mb-2">Document Secured</h4>
                            <p class="text-sm text-green-800/70 mb-3">Block Index: <strong>#${res.block_index}</strong></p>
                            <code class="hash-text bg-green-100 px-3 py-2 rounded block text-green-800 mb-2">${res.block_hash}</code>
                            ${signatureHtml}
                            ${forensicThumbnailHtml}
                            ${forensicHtml}
                        </div>
                        <div class="bg-white p-2 rounded-lg shadow-sm border border-green-100">
                            <img src="${res.qr_image_base64}" class="w-32 h-32" alt="Verification QR"/>
                            <p class="text-[10px] text-center mt-1 text-green-600 font-bold">SCAN TO VERIFY</p>
                        </div>
                    </div>
                </div>`;
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
            if (res.valid) {
                r.innerHTML = `<div class="result-card bg-green-50/50 border border-green-200 rounded-xl p-6 relative overflow-hidden fade-in">
                    <div class="flex items-center gap-3 mb-4"><span class="material-symbols-outlined text-green-600">verified</span><span class="text-xs font-bold text-green-700 uppercase tracking-widest">Status: Valid</span></div>
                    <h4 class="text-lg font-bold text-green-900 mb-2">Original Document</h4>
                    <p class="text-[10px] font-black text-emerald-600 uppercase mb-2">Compared against: ${res.original_uploader}'s upload from ${new Date(res.original_upload_date).toLocaleDateString()}</p>
                    <p class="text-sm text-green-800/70 leading-relaxed">Hash matches the registry record.</p>
                    <code class="hash-text bg-green-100 px-3 py-2 rounded block mt-3 text-green-800 mb-4">${res.original_hash}</code>
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

                r.innerHTML = `<div class="result-card bg-red-50/50 border border-red-200 rounded-xl p-6 relative overflow-hidden fade-in">
                    <div class="flex items-center gap-3 mb-4"><span class="material-symbols-outlined text-red-600">error</span><span class="text-xs font-bold text-red-700 uppercase tracking-widest">Status: Tampered</span></div>
                    <h4 class="text-lg font-bold text-red-900 mb-2">Deep Verification Failed</h4>
                    <p class="text-[10px] font-black text-red-600 uppercase mb-2">Compared against: ${res.original_uploader}'s upload from ${new Date(res.original_upload_date).toLocaleDateString()}</p>
                    <p class="text-sm text-red-800/70 leading-relaxed">System has detected unauthorized modifications via multi-layered analysis.</p>
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
            <div class="bg-surface-container-lowest px-5 py-3 rounded-xl flex items-center gap-4 shadow-sm">
                <div class="text-right"><p class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Network Status</p>
                <p class="text-sm font-bold text-green-600 flex items-center justify-end gap-1"><span class="w-1.5 h-1.5 rounded-full bg-green-500"></span> Synchronized</p></div>
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
            return;
        }
        const sorted = [...chain].reverse();
        body.innerHTML = sorted.map((d, i) => {
            const fname = d.filename.split(/[/\\]/).pop();
            const status = d.is_tampered
                ? '<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-700 text-[10px] font-extrabold uppercase"><span class="w-1.5 h-1.5 rounded-full bg-red-500 pulse-dot"></span>Tampered</span>'
                : '<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-700 text-[10px] font-extrabold uppercase"><span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>Verified</span>';
            return `<tr class="${i%2===0?'':'bg-surface-container-lowest'} hover:bg-slate-50/50 transition-colors">
                <td class="px-6 py-5 text-sm font-bold text-secondary">#${d.block_index}</td>
                <td class="px-6 py-5 text-sm font-semibold text-primary">${fname}</td>
                <td class="px-6 py-5"><code class="text-[11px] font-mono bg-slate-100 px-2 py-1 rounded text-slate-600">${d.block_hash.slice(0,16)}...</code></td>
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
                        <input id="batch-user" class="w-full bg-surface pl-10 pr-4 py-3 rounded-xl border border-outline-variant/30 focus:ring-2 focus:ring-secondary/20 text-on-surface text-sm" placeholder="Full legal name" type="text"/>
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
