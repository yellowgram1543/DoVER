/**
 * Citizen Module - Personal Vault Experience
 */
const CitizenModule = {
    renderDashboard(app) {
        if (typeof renderDashboard === 'function') renderDashboard(app);
    },
    renderUpload(app) {
        if (typeof renderGlobalUpload === 'function') renderGlobalUpload(app);
    },
    renderVerify(app) {
        if (typeof renderVerify === 'function') renderVerify(app);
    },
    renderChain(app) {
        if (typeof renderChain === 'function') renderChain(app);
    },
    renderSettings(app) {
        if (typeof renderSettings === 'function') renderSettings(app);
    },
    renderHelp(app) {
        document.getElementById('page-title').textContent = 'Citizen Help Guide';
        const wrap = document.createElement('div');
        wrap.className = 'max-w-7xl mx-auto space-y-20 fade-in';
        wrap.innerHTML = `<div class="text-center space-y-4">
            <h1 class="text-5xl font-black text-primary tracking-tight">Your Personal <span class="text-secondary">Vault</span> Guide</h1>
            <p class="text-on-surface-variant text-lg max-w-2xl mx-auto">Learn how to secure, manage, and verify your personal documents.</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div class="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl space-y-4">
                <h3 class="text-xl font-bold text-primary">Storing Documents</h3>
                <p class="text-sm text-slate-500">Upload records to "Secure Personal Doc" for immutable blockchain proof.</p>
            </div>
            <div class="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl space-y-4">
                <h3 class="text-xl font-bold text-primary">Verifying Records</h3>
                <p class="text-sm text-slate-500">Use "Quick Verify" to check authenticity against the registry.</p>
            </div>
            <div class="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl space-y-4">
                <h3 class="text-xl font-bold text-primary">Global Ledger</h3>
                <p class="text-sm text-slate-500">View the decentralized history of all documents globally.</p>
            </div>
        </div>`;
        app.appendChild(wrap);
    }
};
window.CitizenModule = CitizenModule;
