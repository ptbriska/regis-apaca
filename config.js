// Ganti URL ini dengan URL Web App dari Google Apps Script (GAS) milik Anda
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbx_GANTI_DENGAN_DEPLOYMENT_ID_ANDA/exec";

document.addEventListener("DOMContentLoaded", () => {
    const totalDisplay = document.getElementById("totalDisplay");
    const totalValue = document.getElementById("totalValue");
    const lokasiInput = document.getElementById("lokasi");
    const submitBtn = document.querySelector(".btn-submit");
    
    // 1. Deteksi Lokasi Otomatis via IP API
    fetch('https://ipapi.co/json/')
        .then(response => response.json())
        .then(data => {
            lokasiInput.value = `${data.city}, ${data.region} (${data.country_name})`;
        })
        .catch(() => {
            lokasiInput.value = "Gagal mendeteksi lokasi otomatis. Silakan isi manual.";
            lokasiInput.removeAttribute("readonly");
        });

    // 2. Fetch Katalog Produk (data.json)
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            renderCheckboxes(data.single_modules, "singleModulesContainer");
            renderCheckboxes(data.bundling_modules, "bundlingModulesContainer");
            calculateTotal(); // Inisialisasi awal
        })
        .catch(err => {
            console.error("Gagal memuat katalog data.json:", err);
            alert("Gagal memuat katalog produk. Pastikan file data.json tersedia.");
        });

    // Fungsi Render Checkbox & Atribut Data
    function renderCheckboxes(items, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        items.forEach(item => {
            const label = document.createElement("label");
            label.className = "checkbox-item";
            
            const formatter = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0});
            const formattedPrice = (item.harga === 0) ? "Gratis" : formatter.format(item.harga);

            const kodeTesString = Array.isArray(item.kode_tes) ? item.kode_tes.join(",") : item.id;

            label.innerHTML = `
                <div>
                    <input type="checkbox" name="produk[]" value="${item.id}" data-harga="${item.harga}" data-kode-tes="${kodeTesString}" onchange="calculateTotal()">
                    <span class="item-name">${item.nama}</span>
                </div>
                <span class="item-price">${formattedPrice}</span>
            `;
            container.appendChild(label);
        });
    }

    // 3. Tangani Submit Form ke Google Apps Script (GAS)
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

        // Rekap semua kode_tes ke modul_diizinkan (Set untuk mengeliminasi duplikat)
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
        if (totalBayar > 0 && fileInput.files.length > 0) {
            const file = fileInput.files[0];
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
            jenis_kelamin: document.getElementById("jenisKelamin").value,
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
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(response => {
            if (response.status === "success") {
                // Tampilkan Modal Pop-Up Konfirmasi Instan
                document.getElementById("modalAccessKey").innerText = response.access_key;
                document.getElementById("modalModulList").innerText = response.modul_diizinkan;
                document.getElementById("confirmationModal").style.display = "flex";

                // Reset Form
                document.getElementById("registrationForm").reset();
                calculateTotal();
            } else {
                alert("Terjadi kesalahan: " + response.message);
            }
        })
        .catch(err => {
            console.error("Error submit form:", err);
            alert("Gagal terhubung ke server. Pastikan GAS Web App URL sudah benar.");
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.innerText = "Daftar & Dapatkan Akses";
        });
    });
});

// Helper Function: Konversi File ke Base64
function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64String = reader.result.split(',')[1];
            resolve({
                fileName: file.name,
                mimeType: file.type,
                base64: base64String
            });
        };
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

// Fungsi Kalkulasi Total Harga Otomatis & Kontrol Upload File Dinamis
function calculateTotal() {
    const checkboxes = document.querySelectorAll('input[name="produk[]"]:checked');
    let total = 0;

    checkboxes.forEach(box => {
        total += parseInt(box.getAttribute("data-harga")) || 0;
    });

    const formatter = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 });
    document.getElementById("totalDisplay").innerText = formatter.format(total);
    document.getElementById("totalValue").value = total;

    // Logika Otomatisasi Bukti Bayar
    const buktiBayarGroup = document.getElementById("buktiBayarGroup");
    const buktiBayarInput = document.getElementById("buktiBayar");
    const buktiBayarLabel = document.getElementById("buktiBayarLabel");

    if (total === 0) {
        // Jika Gratis (0 Rupiah)
        buktiBayarInput.removeAttribute("required");
        buktiBayarInput.value = "";
        if (buktiBayarGroup) buktiBayarGroup.style.display = "none";
    } else {
        // Jika Berbayar (> 0 Rupiah)
        buktiBayarInput.setAttribute("required", "required");
        if (buktiBayarGroup) buktiBayarGroup.style.display = "block";
        if (buktiBayarLabel) buktiBayarLabel.innerHTML = 'Upload Bukti Bayar <span style="color:red">*</span>';
    }
}

// Fungsi Modal Pop-Up Konfirmasi
function closeModal() {
    document.getElementById("confirmationModal").style.display = "none";
}

function copyAccessKey() {
    const keyText = document.getElementById("modalAccessKey").innerText;
    navigator.clipboard.writeText(keyText).then(() => {
        alert("Kode Akses berhasil disalin ke clipboard!");
    });
}
