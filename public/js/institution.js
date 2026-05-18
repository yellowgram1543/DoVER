/**
 * Institution Module - Corporate Console Experience
 */
const InstitutionModule = {
    renderDashboard(app) {
        document.getElementById('page-title').textContent = 'Institutional Portal';
        const wrap = document.createElement('div');
        wrap.className = 'max-w-7xl mx-auto space-y-8 fade-in';

        const header = document.createElement('div');
        header.innerHTML = `<div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div><span class="text-secondary font-bold tracking-widest uppercase text-xs">Corporate Governance & Employee Records</span>
            <h1 class="text-3xl font-extrabold text-primary tracking-tight mt-1">Admin Overview</h1></div>
            <a href="#/console/upload" class="bg-primary text-on-primary px-6 py-3 rounded-xl font-semibold flex items-center gap-2 shadow-lg shadow-primary/20 hover:bg-opacity-90 active:scale-95 transition-all">
                <span class="material-symbols-outlined text-lg">add</span> Issue New Certificate</a>
        </div>`;
        wrap.appendChild(header);
        
        if (typeof renderStatsBar === 'function') renderStatsBar(wrap);

        const explorer = document.createElement('div');
        explorer.className = 'bg-surface-container-lowest rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden';

        const categories = ['all', ...Object.keys(CATEGORY_MAP['b2b'])];

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
                    <input type="text" placeholder="Search records..." class="pl-10 pr-4 py-2 bg-slate-50 dark:bg-black/20 border-none rounded-xl text-xs focus:ring-2 focus:ring-primary/10 w-full md:w-64"/>
                </div>
            </div>
            <div id="vault-list" class="min-h-[400px]"></div>
        `;
        wrap.appendChild(explorer);
        app.appendChild(wrap);

        if (typeof loadVaultDocuments === 'function') {
            loadVaultDocuments(document.getElementById('vault-list'));
        }
    },

    renderUpload(app) {
        if (typeof renderGlobalUpload === 'function') renderGlobalUpload(app);
    },

    renderVerify(app) {
        if (typeof renderGlobalVerify === 'function') renderGlobalVerify(app);
    },

    renderBatch(app) {
        if (typeof renderGlobalBatch === 'function') renderGlobalBatch(app);
    },

    renderAudit(app) {
        if (typeof renderGlobalAudit === 'function') renderGlobalAudit(app);
    },

    renderChain(app) {
        if (typeof renderGlobalChain === 'function') renderGlobalChain(app);
    },

    async renderAdmin(app) {
        if (typeof renderGlobalAdmin === 'function') await renderGlobalAdmin(app);
    },

    renderSettings(app) {
        if (typeof renderGlobalSettings === 'function') renderGlobalSettings(app);
    },

    renderHelp(app) {
        document.getElementById('page-title').textContent = 'Institutional Console Guide';
        const wrap = document.createElement('div');
        wrap.className = 'max-w-7xl mx-auto space-y-20 fade-in';

        wrap.innerHTML = `
            <div class="text-center space-y-4">
                <div class="inline-flex items-center gap-2 px-3 py-1 bg-secondary text-white rounded-full text-[10px] font-black tracking-widest uppercase mb-2">Institutional Console v1.0</div>
                <h1 class="text-5xl font-black text-primary tracking-tight">Organization <span class="text-secondary">Console</span> Guide</h1>
                <p class="text-on-surface-variant text-lg max-w-2xl mx-auto font-medium">Enterprise tools for issuing, managing, and auditing official document flows.</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div class="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-200/40 border border-slate-100 space-y-6">
                    <div class="w-12 h-12 bg-blue-50 text-secondary rounded-xl flex items-center justify-center">
                        <span class="material-symbols-outlined">upload_file</span>
                    </div>
                    <h3 class="text-xl font-bold text-primary">Issuing Certificates</h3>
                    <p class="text-sm text-slate-500 leading-relaxed">Use "Institutional Upload" to issue new official records. These are signed by your organization's cryptographic key and anchored to the blockchain.</p>
                </div>

                <div class="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-200/40 border border-slate-100 space-y-6">
                    <div class="w-12 h-12 bg-blue-50 text-secondary rounded-xl flex items-center justify-center">
                        <span class="material-symbols-outlined">folder_managed</span>
                    </div>
                    <h3 class="text-xl font-bold text-primary">Batch Processing</h3>
                    <p class="text-sm text-slate-500 leading-relaxed">The "Batch Ingestion" tool allows for large-scale document securing via CSV/Folder uploads, ideal for end-of-semester or payroll cycles.</p>
                </div>

                <div class="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-200/40 border border-slate-100 space-y-6">
                    <div class="w-12 h-12 bg-blue-50 text-secondary rounded-xl flex items-center justify-center">
                        <span class="material-symbols-outlined">history_edu</span>
                    </div>
                    <h3 class="text-xl font-bold text-primary">Compliance & Auditing</h3>
                    <p class="text-sm text-slate-500 leading-relaxed">Access the "Compliance Logs" to view a full history of all actions taken by your organization's personnel, ensuring total accountability.</p>
                </div>
            </div>
        `;
        app.appendChild(wrap);
    }
};

window.InstitutionModule = InstitutionModule;
