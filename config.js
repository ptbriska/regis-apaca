// URL Web App Google Apps Script (GAS) APACA Consulting
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxhJ29sqa5M92O6Xfh1UOo1W7TfKh8BiM2BEnaGtgCPMG4OcBLX7C1rGCTrVtn4au6_/exec";

// Variabel Global untuk menyimpan data produk murni
let globalSingleModulesMap = new Map();

document.addEventListener("DOMContentLoaded", () => {
    const lokasiInput = document.getElementById("lokasi");
    const submitBtn = document.getElementById("btnSubmit") || document.querySelector(".btn-submit");
    
    // 1. Deteksi Lokasi Otomatis via IP API (DIpertahankan)
    fetch('https://ipapi.co/json/')
        .then(response => response.json())
        .then(data => {
            lokasiInput.value = `${data.city}, ${data.region} (${data.country_name})`;
        })
        .catch(() => {
            lokasiInput.value = "";
            lokasiInput.placeholder = "Ketik kota/lokasi Anda manual...";
        });

    // 2. Fetch Katalog Produk (data.json) dengan Injeksi UI/UX Baru
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            // Simpan referensi single modules untuk kalkulasi harga asli bundling
            data.single_modules.forEach(m => globalSingleModulesMap.set(m.id, m));

            // Render ke UI dengan Sistem Tab Kategori
            renderTabsAndModules(data.single_modules, "singleTabsContainer", "singleModulesContainer", false);
            renderTabsAndModules(data.bundling_modules, "bundlingTabsContainer", "bundlingModulesContainer", true);
            
            calculateTotal(); // Inisialisasi awal
        })
        .catch(err => {
            console.error("Gagal memuat katalog data.json:", err);
            alert("Gagal memuat katalog produk. Pastikan file data.json tersedia.");
        });

    // 3. Tangani Submit Form (Algoritma asli dipertahankan penuh)
    document.getElementById("registrationForm").addEventListener("submit", async function(e) {
        e.preventDefault();

        const checkboxes = document.querySelectorAll('input[name="produk[]"]:checked');
        if (checkboxes.length === 0) {
            alert("Silakan pilih minimal 1 modul tes atau bundling.");
            return;
        }

        const totalBayar = parseInt(document.getElementById("totalValue").value) || 0;
        const fileInput = document.getElementById("buktiBayar");

        // Validasi Bukti Bayar khusus jika Total Bayar > 0
        if (totalBayar > 0 && (!fileInput.files || fileInput.files.length === 0)) {
            alert("Silakan upload bukti pembayaran terlebih dahulu.");
            return;
        }

        // Rekap semua kode_tes ke modul_diizinkan (Bebas duplikat)
        const modulDiizinkanSet = new Set();
        const produkDipilih = [];

        checkboxes.forEach(box => {
            produkDipilih.push(box.value);
            const listKode = box.getAttribute("data-kode-tes").split(",");
            listKode.forEach(k => {
                if (k.trim() !== "") modulDiizinkanSet.add(k.trim());
            });
        });

        const modulDiizinkanString = Array.from(modulDiizinkanSet).join(", ");

        // Pengolahan File Bukti Bayar ke Base64 (Hanya jika berbayar)
        let fileData = null;
        if (totalBayar > 0 && fileInput.files && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            if (file.size > 5 * 1024 * 1024) {
                alert("Ukuran berkas terlalu besar! Maksimal ukuran berkas bukti bayar adalah 5 MB.");
                return;
            }
            try {
                fileData = await convertFileToBase64(file);
            } catch (error) {
                alert("Gagal memproses berkas bukti bayar.");
                return;
            }
        }

        // Susun Payload Lengkap
        const payload = {
            nama: document.getElementById("nama").value,
            email: document.getElementById("email").value,
            whatsapp: document.getElementById("whatsapp").value,
            jenis_kelamin: document.querySelector('input[name="jenisKelamin"]:checked')?.value || "",
            usia: document.getElementById("usia").value,
            instansi: document.getElementById("instansi").value,
            lokasi: document.getElementById("lokasi").value,
            tujuan_tes: document.getElementById("tujuanTes").value,
            produk_dipilih: produkDipilih.join(", "),
            modul_diizinkan: modulDiizinkanString,
            total_bayar: totalBayar,
            bukti_bayar: fileData
        };

        // Indikator Loading
        submitBtn.disabled = true;
        submitBtn.innerText = "Memproses Pendaftaran...";

        // Kirim HTTP POST ke Google Apps Script
        fetch(GAS_WEB_APP_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(response => {
            if (response.status === "success") {
                const receiptData = {
                    access_key: response.access_key,
                    nama: payload.nama,
                    email: payload.email,
                    whatsapp: payload.whatsapp,
                    instansi: payload.instansi,
                    lokasi: payload.lokasi,
                    modul_diizinkan: response.modul_diizinkan,
                    total_bayar: payload.total_bayar
                };
                sessionStorage.setItem("pats_receipt_data", JSON.stringify(receiptData));
                window.location.href = "buktibayar.html";
            } else {
                alert("Terjadi kesalahan dari server: " + response.message);
                submitBtn.disabled = false;
                submitBtn.innerText = "Daftar & Lanjut Pembayaran";
            }
        })
        .catch(err => {
            console.error("Proses server selesai/CORS warning:", err);
            // Fallback aman tetap dijaga!
            const yearNow = new Date().getFullYear();
            const fallbackKey = `PATS-${yearNow}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
            const fallbackReceiptData = {
                access_key: fallbackKey,
                nama: payload.nama,
                email: payload.email,
                whatsapp: payload.whatsapp,
                instansi: payload.instansi,
                lokasi: payload.lokasi,
                modul_diizinkan: payload.modul_diizinkan,
                total_bayar: payload.total_bayar
            };
            sessionStorage.setItem("pats_receipt_data", JSON.stringify(fallbackReceiptData));
            window.location.href = "buktibayar.html";
        });
    });
});

// Helper Function: Konversi File ke Base64 (Dipertahankan)
function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ fileName: file.name, mimeType: file.type, base64: reader.result.split(',')[1] });
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

/* =======================================================================
   FUNGSI UI/UX BARU: RENDER TAB, HARGA CORET & ANTI-DUPLICATE
   ======================================================================= */

function renderTabsAndModules(items, tabsContainerId, listContainerId, isBundling) {
    const tabsContainer = document.getElementById(tabsContainerId);
    const listContainer = document.getElementById(listContainerId);
    if (!tabsContainer || !listContainer) return;

    // Kelompokkan item berdasarkan 'kategori'
    const groupedData = items.reduce((acc, item) => {
        if (!acc[item.kategori]) acc[item.kategori] = [];
        acc[item.kategori].push(item);
        return acc;
    }, {});

    const categories = Object.keys(groupedData);
    if (categories.length === 0) return;

    // Buat Tombol Tab & Container per Kategori
    categories.forEach((kategori, index) => {
        const safeKategoriId = kategori.replace(/[^a-zA-Z0-9]/g, "_") + "_" + (isBundling ? "bnd" : "sgl");
        
        // Buat Tab Button
        const tabBtn = document.createElement("button");
        tabBtn.type = "button";
        tabBtn.className = `tab-btn ${index === 0 ? "active" : ""}`;
        tabBtn.innerText = kategori;
        tabBtn.onclick = () => activateTab(tabsContainer, listContainer, safeKategoriId, tabBtn);
        tabsContainer.appendChild(tabBtn);

        // Buat Tab Pane (List Checkbox)
        const tabPane = document.createElement("div");
        tabPane.className = `tab-pane ${index === 0 ? "active" : ""}`;
        tabPane.id = safeKategoriId;

        // Render Item di dalam Pane
        groupedData[kategori].forEach(item => {
            const label = document.createElement("label");
            label.className = "checkbox-item";
            
            const formatter = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 });
            let displayPrice = (item.harga === 0) ? `<span class="badge-free">GRATIS</span>` : `<span class="item-price">${formatter.format(item.harga)}</span>`;
            
            // Logika Harga Coret Khusus Bundling
            let savingsInfo = "";
            if (isBundling && globalSingleModulesMap.size > 0 && item.harga > 0) {
                let realValue = 0;
                item.kode_tes.forEach(kode => {
                    const single = globalSingleModulesMap.get(kode);
                    if (single) realValue += single.harga;
                });
                
                if (realValue > item.harga) {
                    const hemat = realValue - item.harga;
                    displayPrice = `
                        <div class="price-bundle-wrapper">
                            <span class="price-strike">${formatter.format(realValue)}</span>
                            <span class="item-price">${formatter.format(item.harga)}</span>
                        </div>
                    `;
                    savingsInfo = `<span class="badge-save">Hemat ${formatter.format(hemat)}</span>`;
                }
            }

            const kodeTesString = Array.isArray(item.kode_tes) ? item.kode_tes.join(",") : item.id;
            const inputClass = isBundling ? "bundle-chk" : "single-chk";

            label.innerHTML = `
                <div class="item-left">
                    <input type="checkbox" name="produk[]" class="${inputClass}" value="${item.id}" data-nama="${item.nama}" data-harga="${item.harga}" data-kode-tes="${kodeTesString}" onchange="calculateTotal()">
                    <div class="item-details">
                        <span class="item-name">${item.nama}</span>
                        ${savingsInfo}
                    </div>
                </div>
                <div class="item-right">${displayPrice}</div>
            `;
            tabPane.appendChild(label);
        });

        listContainer.appendChild(tabPane);
    });
}

function activateTab(tabsContainer, listContainer, targetPaneId, activeBtn) {
    // Reset tombol active
    tabsContainer.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
    activeBtn.classList.add("active");

    // Reset pane active
    listContainer.querySelectorAll(".tab-pane").forEach(pane => pane.classList.remove("active"));
    document.getElementById(targetPaneId).classList.add("active");
}

function calculateTotal() {
    // === CONFLICT GUARD (Anti Double-Pay) ===
    const bundleCheckboxes = document.querySelectorAll('.bundle-chk:checked');
    const includedCodesSet = new Set();
    
    // Kumpulkan semua kode sub-tes dari paket bundling yang dipilih
    bundleCheckboxes.forEach(box => {
        const codes = box.getAttribute("data-kode-tes").split(",");
        codes.forEach(c => includedCodesSet.add(c.trim()));
    });

    // Evaluasi Single Modules: Kunci jika sudah ada di dalam paket Bundling
    const singleCheckboxes = document.querySelectorAll('.single-chk');
    singleCheckboxes.forEach(box => {
        const id = box.value;
        const parentLabel = box.closest('.checkbox-item');
        
        if (includedCodesSet.has(id)) {
            box.checked = false; 
            box.disabled = true;
            parentLabel.classList.add('disabled-by-bundle');
            parentLabel.setAttribute('title', 'Modul ini sudah termasuk di dalam paket Bundling yang Anda pilih.');
        } else {
            box.disabled = false;
            parentLabel.classList.remove('disabled-by-bundle');
            parentLabel.removeAttribute('title');
        }
    });

    // === KALKULASI TOTAL & ORDER SUMMARY ===
    const allCheckedBoxes = document.querySelectorAll('input[name="produk[]"]:checked');
    let total = 0;
    let selectedNames = [];

    allCheckedBoxes.forEach(box => { 
        total += parseInt(box.getAttribute("data-harga")) || 0; 
        
        // Ambil kode id saja (teks sebelum tanda "-") agar summary ringkas
        const namaLengkap = box.getAttribute("data-nama");
        const kodeSingkat = namaLengkap.split(" - ")[0];
        selectedNames.push(kodeSingkat);
    });

    const formatter = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 });
    document.getElementById("totalDisplay").innerText = formatter.format(total);
    document.getElementById("totalValue").value = total;

    // Update Order Summary UI
    const orderSummaryContainer = document.getElementById("orderSummaryContainer");
    if (orderSummaryContainer) {
        if (selectedNames.length === 0) {
            orderSummaryContainer.innerHTML = `<span class="text-muted">Belum ada modul yang dipilih</span>`;
        } else {
            orderSummaryContainer.innerHTML = `<strong>${selectedNames.length} Pilihan:</strong><br><span class="summary-list">${selectedNames.join(", ")}</span>`;
        }
    }

    // Tampilkan / Sembunyikan Area Pembayaran & Info Rekening
    const buktiBayarGroup = document.getElementById("buktiBayarGroup");
    const infoRekeningGroup = document.getElementById("infoRekeningGroup");
    const buktiBayarInput = document.getElementById("buktiBayar");

    if (total === 0) {
        if (buktiBayarInput) {
            buktiBayarInput.removeAttribute("required");
            buktiBayarInput.value = "";
        }
        if (buktiBayarGroup) buktiBayarGroup.style.display = "none";
        if (infoRekeningGroup) infoRekeningGroup.style.display = "none";
    } else {
        if (buktiBayarInput) buktiBayarInput.setAttribute("required", "required");
        if (buktiBayarGroup) buktiBayarGroup.style.display = "block";
        if (infoRekeningGroup) infoRekeningGroup.style.display = "block";
    }
}
