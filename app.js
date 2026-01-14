const API_URL = "https://besointech.ferhathamza17.workers.dev";
let currentUser = null;
let currentRequestData = null;

// --- SECURITY: PREVENT F12 & INSPECT ---
document.onkeydown = function(e) {
    if(e.keyCode == 123) return false; // F12
    if(e.ctrlKey && e.shiftKey && e.keyCode == 'I'.charCodeAt(0)) return false; // Ctrl+Shift+I
    if(e.ctrlKey && e.shiftKey && e.keyCode == 'J'.charCodeAt(0)) return false; // Ctrl+Shift+J
    if(e.ctrlKey && e.keyCode == 'U'.charCodeAt(0)) return false; // Ctrl+U (View Source)
};
document.addEventListener('contextmenu', event => event.preventDefault()); // Right Click

// --- AUTH ---
document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    const username = e.target[0].value;
    const password = e.target[1].value;
    
    const res = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        body: JSON.stringify({ username, password })
    });

    if (res.ok) {
        currentUser = await res.json();
        sessionStorage.setItem('epipharm_user', JSON.stringify(currentUser));
        initApp();
    } else {
        alert("Accès refusé");
    }
};

function initApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('user-display').innerText = `${currentUser.full_name} (${currentUser.service_name})`;
    
    if (currentUser.role === 'admin') {
        document.getElementById('admin-view').classList.remove('hidden');
        loadAdminProducts();
        loadAdminRequests();
    } else {
        document.getElementById('chef-view').classList.remove('hidden');
        loadCatalog();
        loadChefHistory();
    }
}

// --- ADMIN LOGIC ---
async function loadAdminProducts() {
    const res = await fetch(`${API_URL}/api/admin/products-all`);
    const prods = await res.json();
    document.getElementById('products-table-body').innerHTML = prods.map(p => `
        <tr class="border-b hover:bg-slate-50">
            <td class="p-2 text-sm">
                <div class="font-bold">${p.name_fr}</div>
                <div class="text-[10px] text-gray-400">${p.price.toFixed(2)} DA / ${p.unit}</div>
            </td>
            <td class="p-2 text-right">
                <button onclick="deleteProduct(${p.id})" class="text-red-400 hover:text-red-600">×</button>
            </td>
        </tr>
    `).join('');
}

// --- FACTURE ESTIMATIVE GENERATION ---
async function printGlobalInvoice() {
    const res = await fetch(`${API_URL}/api/admin/requests`);
    const all = await res.json();
    const validated = all.filter(r => r.status === 'validated');

    if (validated.length === 0) return alert("Aucune demande validée à facturer.");

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const TVA_RATE = 0.19;
    let totalHT = 0;

    // Header (Bilingual)
    doc.setFontSize(10);
    doc.text("EPSP BERRIANE - Bureau SII", 15, 15);
    doc.setFontSize(16);
    doc.text("FACTURE ESTIMATIVE / فاتورة تقديرية", 105, 30, { align: "center" });

    let currentY = 50;

    // Grouping by Service
    const services = [...new Set(validated.map(r => r.service_name))];

    for (const service of services) {
        const rows = [];
        let serviceHT = 0;
        
        // Fetch items for each request in this service
        for (const req of validated.filter(r => r.service_name === service)) {
            const dRes = await fetch(`${API_URL}/api/request-details/${req.id}`);
            const data = await dRes.json();
            data.items.forEach(i => {
                const pt = i.quantity * (i.price_at_request || 0);
                serviceHT += pt;
                rows.push([i.product_name, i.unit, i.quantity, i.price_at_request.toFixed(2), pt.toFixed(2)]);
            });
        }

        doc.setFontSize(12);
        doc.text(`SERVICE: ${service}`, 15, currentY);
        
        doc.autoTable({
            startY: currentY + 5,
            head: [['Désignation', 'Unité', 'Qté', 'P.U (DA)', 'Total (DA)']],
            body: rows,
            theme: 'striped',
            styles: { fontSize: 9 }
        });

        totalHT += serviceHT;
        currentY = doc.lastAutoTable.finalY + 15;
        if (currentY > 250) { doc.addPage(); currentY = 20; }
    }

    // Summary
    const tva = totalHT * TVA_RATE;
    const ttc = totalHT + tva;

    doc.autoTable({
        startY: currentY,
        body: [
            ['TOTAL H.T', totalHT.toFixed(2) + ' DA'],
            ['TVA (19%)', tva.toFixed(2) + ' DA'],
            ['TOTAL T.T.C', ttc.toFixed(2) + ' DA']
        ],
        margin: { left: 120 }
    });

    window.open(doc.output('bloburl'), '_blank');
}

function logout() {
    sessionStorage.clear();
    location.reload();
}
