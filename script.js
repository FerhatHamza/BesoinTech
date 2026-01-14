const API_URL = "https://besointech.ferhathamza17.workers.dev";
// --- CONFIG & TRANSLATION ---
let currentLang = 'fr';
let currentUser = JSON.parse(localStorage.getItem('user'));
let currentRequestData = null;

const LANG = {
    fr: { welcome: "Bienvenue,", nav_logout: "Quitter", lbl_qty: "Qté", stat_pending: "En attente", stat_val: "Validé" },
    ar: { welcome: "مرحباً بكم،", nav_logout: "خروج", lbl_qty: "الكمية", stat_pending: "قيد الانتظار", stat_val: "مقبول" }
};

// --- SECURITY: ANTI-F12 ---
document.addEventListener('contextmenu', e => e.preventDefault());
document.onkeydown = (e) => {
    if (e.keyCode === 123 || (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74)) || (e.ctrlKey && e.keyCode === 85)) {
        return false;
    }
};

// --- AUTH LOGIC ---
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const res = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        body: JSON.stringify({ username, password })
    });
    if (res.ok) {
        currentUser = await res.json();
        localStorage.setItem('user', JSON.stringify(currentUser));
        initApp();
    } else {
        alert("Identifiants incorrects");
    }
});

function logout() {
    localStorage.clear();
    location.reload();
}

function initApp() {
    if (!currentUser) return;
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    if (currentUser.role === 'admin') {
        document.getElementById('view-admin').classList.remove('hidden');
        switchAdminTab('requests');
    } else {
        document.getElementById('view-chef').classList.remove('hidden');
        document.getElementById('chef-service-display').innerText = currentUser.service_name;
        loadProducts();
    }
}

// --- ADMIN LOGIC ---
async function switchAdminTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.add('hidden'));
    document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.replace('bg-slate-800', 'bg-white'));
    document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.replace('text-white', 'text-gray-800'));
    
    document.getElementById(`admin-tab-${tab}`).classList.remove('hidden');
    const btn = document.getElementById(`nav-${tab}`);
    btn.classList.replace('bg-white', 'bg-slate-800');
    btn.classList.replace('text-gray-800', 'text-white');

    if (tab === 'requests') loadAdminRequests();
    if (tab === 'products') loadAdminProducts();
}

async function loadAdminRequests() {
    const res = await fetch(`${API_URL}/api/admin/requests`);
    const data = await res.json();
    document.getElementById('requests-table-body').innerHTML = data.map(r => `
        <tr class="border-b hover:bg-gray-50">
            <td class="p-4 text-xs text-gray-500">${new Date(r.created_at).toLocaleDateString()}</td>
            <td class="p-4 font-bold text-sm">${r.service_name}<br><span class="text-xs font-normal text-gray-400">${r.full_name}</span></td>
            <td class="p-4 text-center">
                <span class="px-2 py-1 rounded-full text-[10px] font-bold uppercase ${r.status === 'validated' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">${r.status}</span>
            </td>
            <td class="p-4 text-right">
                <button onclick="viewAndPrint(${r.id})" class="text-blue-600 font-bold text-xs">Ouvrir</button>
            </td>
        </tr>
    `).join('');
}

// --- CHEF LOGIC ---
async function loadProducts() {
    const res = await fetch(`${API_URL}/api/products`);
    const prods = await res.json();
    const list = document.getElementById('products-list');
    list.innerHTML = prods.map(p => `
        <div class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full">
            <h3 class="font-bold text-sm mb-1">${currentLang === 'ar' ? p.name_ar : p.name_fr}</h3>
            <p class="text-[10px] text-gray-400 uppercase font-bold mb-4">${p.category}</p>
            <div class="mt-auto flex items-center gap-2">
                <input type="number" min="0" placeholder="0" class="w-full border-2 border-gray-50 p-2 rounded-xl text-center font-bold focus:border-blue-500 outline-none" 
                    onchange="handleQtyChange(this, ${p.id}, '${p.name_fr}', ${p.price}, '${p.unit}', ${p.requires_detail})">
            </div>
            <div id="extra-${p.id}" class="hidden mt-2 space-y-1">
                <input type="text" id="note-${p.id}" placeholder="Note..." class="w-full text-[10px] border p-1 rounded">
                <div id="alloc-${p.id}"></div>
            </div>
        </div>
    `).join('');
}

let selectedItems = {};

window.handleQtyChange = function(input, id, name, price, unit, detail) {
    const qty = parseInt(input.value) || 0;
    const extra = document.getElementById(`extra-${id}`);
    const alloc = document.getElementById(`alloc-${id}`);
    
    if (qty > 0) {
        extra.classList.remove('hidden');
        selectedItems[id] = { name, quantity: qty, price, unit, allocations: [], notes: "" };
        if (detail) {
            alloc.innerHTML = Array.from({length: qty}, (_, i) => `<input type="text" placeholder="Affectation ${i+1}" class="w-full text-[10px] border p-1 mt-1 rounded alloc-input-${id}">`).join('');
        }
    } else {
        extra.classList.add('hidden');
        delete selectedItems[id];
    }
};

document.getElementById('needs-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!confirm("Envoyer cette fiche ?")) return;

    const finalItems = [];
    // Standard Items
    for (const [id, item] of Object.entries(selectedItems)) {
        item.notes = document.getElementById(`note-${id}`).value;
        const allocs = [];
        document.querySelectorAll(`.alloc-input-${id}`).forEach(inp => allocs.push(inp.value));
        item.allocations = allocs;
        finalItems.push(item);
    }
    // Custom Items logic here...

    await fetch(`${API_URL}/api/submit`, {
        method: 'POST',
        body: JSON.stringify({ user_id: currentUser.id, items: finalItems })
    });
    alert("Envoyé avec succès !");
    location.reload();
});

// --- PRINTING (FACTURE ESTIMATIVE) ---
async function printGlobalFacture() {
    const res = await fetch(`${API_URL}/api/admin/global-facture`);
    const data = await res.json();
    if (!data.length) return alert("Aucun article validé pour le moment.");

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(10);
    doc.text("REPUBLIQUE ALGERIENNE DEMOCRATIQUE ET POPULAIRE", 105, 10, { align: "center" });
    doc.text("ETABLISSEMENT PUBLIC DE SANTE DE PROXIMITE - BERRIANE", 105, 16, { align: "center" });
    
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("FACTURE ESTIMATIVE GLOBALE", 105, 30, { align: "center" });

    const rows = data.map((item, index) => [
        index + 1,
        item.product_name,
        item.unit_at_time,
        item.quantity,
        item.price_at_time.toFixed(2),
        (item.quantity * item.price_at_time).toFixed(2)
    ]);

    doc.autoTable({
        startY: 40,
        head: [['#', 'Designation', 'Unité', 'Qnt', 'Prix U.', 'Total']],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [51, 65, 85] },
        styles: { fontSize: 9 }
    });

    const subtotal = data.reduce((sum, i) => sum + (i.quantity * i.price_at_time), 0);
    const tva = subtotal * 0.19;
    const totalTTC = subtotal + tva;

    let finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.text(`Total HT: ${subtotal.toFixed(2)} DA`, 140, finalY);
    doc.text(`TVA (19%): ${tva.toFixed(2)} DA`, 140, finalY + 6);
    doc.setFontSize(12);
    doc.text(`TOTAL TTC: ${totalTTC.toFixed(2)} DA`, 140, finalY + 14);

    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.text(`Arrêté la présente facture à la somme de: ${totalTTC.toFixed(2)} DA`, 20, finalY + 25);

    window.open(doc.output('bloburl'), '_blank');
}

// Initial Call
if (localStorage.getItem('user')) initApp();
