/**
 * Citizen Module - Personal Vault Experience
 */
const CitizenModule = {
    renderDashboard(app) {
        document.getElementById('page-title').textContent = 'My Personal Vault';
        const wrap = document.createElement('div');
        wrap.className = 'max-w-7xl mx-auto space-y-8 fade-in';

        const header = document.createElement('div');
        header.innerHTML = `<div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div><span class="text-secondary font-bold tracking-widest uppercase text-xs">Self-Sovereign Identity & Life Records</span>
            <h1 class="text-3xl font-extrabold text-primary tracking-tight mt-1">Secure Document Storage</h1></div>
            <a href="#/vault/upload" class="bg-primary text-on-primary px-6 py-3 rounded-xl font-semibold flex items-center gap-2 shadow-lg shadow-primary/20 hover:bg-opacity-90 active:scale-95 transition-all">
                <span class="material-symbols-outlined text-lg">add</span> Protect New Document</a>
        </div>`;
        wrap.appendChild(header);
        
        if (typeof renderStatsBar === 'function') renderStatsBar(wrap);

        const explorer = document.createElement('div');
        explorer.className = 'bg-surface-container-lowest rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden';

        const categories = ['all', ...Object.keys(CATEGORY_MAP['b2c'])];

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

    renderChain(app) {
        if (typeof renderGlobalChain === 'function') renderGlobalChain(app);
    },

    renderSettings(app) {
        if (typeof renderGlobalSettings === 'function') renderGlobalSettings(app);
    },

    renderHelp(app) {
        document.getElementById('page-title').textContent = 'Citizen Help Guide';
        const wrap = document.createElement('div');
        wrap.className = 'max-w-7xl mx-auto space-y-20 fade-in';

        wrap.innerHTML = `
            <div class="text-center space-y-4">
                <div class="inline-flex items-center gap-2 px-3 py-1 bg-primary text-white rounded-full text-[10px] font-black tracking-widest uppercase mb-2">Citizen Portal v1.0</div>
                <h1 class="text-5xl font-black text-primary tracking-tight">Your Personal <span class="text-secondary">Vault</span> Guide</h1>
                <p class="text-on-surface-variant text-lg max-w-2xl mx-auto font-medium">Learn how to secure, manage, and verify your personal documents on the blockchain.</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div class="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-200/40 border border-slate-100 space-y-6">
                    <div class="w-12 h-12 bg-blue-50 text-primary rounded-xl flex items-center justify-center">
                        <span class="material-symbols-outlined">add_moderator</span>
                    </div>
                    <h3 class="text-xl font-bold text-primary">Storing Documents</h3>
                    <p class="text-sm text-slate-500 leading-relaxed">Navigate to "Secure Personal Doc" to upload your records. Every document is hashed and timestamped, ensuring you have an immutable original copy forever.</p>
                </div>

                <div class="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-200/40 border border-slate-100 space-y-6">
                    <div class="w-12 h-12 bg-blue-50 text-primary rounded-xl flex items-center justify-center">
                        <span class="material-symbols-outlined">verified_user</span>
                    </div>
                    <h3 class="text-xl font-bold text-primary">Verifying Records</h3>
                    <p class="text-sm text-slate-500 leading-relaxed">Use the "Quick Verify" tool to check if a document in your possession matches the official record. Ideal for proving certificates or IDs to third parties.</p>
                </div>

                <div class="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-200/40 border border-slate-100 space-y-6">
                    <div class="w-12 h-12 bg-blue-50 text-primary rounded-xl flex items-center justify-center">
                        <span class="material-symbols-outlined">account_balance_wallet</span>
                    </div>
                    <h3 class="text-xl font-bold text-primary">Self-Sovereignty</h3>
                    <p class="text-sm text-slate-500 leading-relaxed">You own your data. Our platform only stores cryptographic proofs. Your actual files are never accessible to us without your explicit action.</p>
                </div>
            </div>
        `;
        app.appendChild(wrap);
    }
};

window.CitizenModule = CitizenModule;
