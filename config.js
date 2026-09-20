const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxhJ29sqa5M92O6Xfh1UOo1W7TfKh8BiM2BEnaGtgCPMG4OcBLX7C1rGCTrVtn4au6_/exec";

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
            calculateTotal();
        })
        .catch(err => {
            console.error("Gagal memuat katalog data.json:", err);
            alert("Gagal memuat katalog produk. Pastikan file data.json tersedia.");
        });

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

    // 3. Tangani Submit Form
    document.getElementById("registrationForm").addEventListener("submit", async function(e) {
        e.preventDefault();

        const checkboxes = document.querySelectorAll('input[name="produk[]"]:checked');
        if (checkboxes.length === 0) {
            alert("Silakan pilih minimal 1 modul tes atau bundling.");
            return;
        }

        const totalBayar = parseInt(document.getElementById("totalValue").value) || 0;
        const fileInput = document.getElementById("buktiBayar");

        if (totalBayar > 0 && (!fileInput.files || fileInput.files.length === 0)) {
            alert("Silakan upload bukti pembayaran terlebih dahulu.");
            return;
        }

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

    // Batasi ukuran maksimal 5 MB
    if (file.size > 5 * 1024 * 1024) {
        alert("Ukuran berkas terlalu besar! Maksimal ukuran berkas bukti bayar adalah 5 MB.");
        submitBtn.disabled = false;
        submitBtn.innerText = "Daftar & Dapatkan Akses";
        return;
    }

    try {
        fileData = await convertFileToBase64(file);
    } catch (error) {
        alert("Gagal memproses berkas bukti bayar.");
        submitBtn.disabled = false;
        submitBtn.innerText = "Daftar & Dapatkan Akses";
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
    bukti_bayar: fileData // Dikirim sebagai objek { fileName, mimeType, base64 } atau null
};

        submitBtn.disabled = true;
        submitBtn.innerText = "Memproses Pendaftaran...";

        fetch(GAS_WEB_APP_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(response => {
            if (response.status === "success") {
                // Simpan data pendaftaran ke sessionStorage untuk dibaca di buktibayar.html
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

                // Alihkan pendaftar ke halaman Kwitansi Resmi (buktibayar.html)
                window.location.href = "buktibayar.html";
            } else {
                alert("Terjadi kesalahan: " + response.message);
                submitBtn.disabled = false;
                submitBtn.innerText = "Daftar & Dapatkan Akses";
            }
        })
        .catch(err => {
            console.error("Error submit form:", err);
            alert("Gagal terhubung ke server. Pastikan GAS Web App URL sudah benar.");
            submitBtn.disabled = false;
            submitBtn.innerText = "Daftar & Dapatkan Akses";
        });
    });
});

function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ fileName: file.name, mimeType: file.type, base64: reader.result.split(',')[1] });
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

function calculateTotal() {
    const checkboxes = document.querySelectorAll('input[name="produk[]"]:checked');
    let total = 0;
    checkboxes.forEach(box => { total += parseInt(box.getAttribute("data-harga")) || 0; });

    const formatter = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 });
    document.getElementById("totalDisplay").innerText = formatter.format(total);
    document.getElementById("totalValue").value = total;

    const buktiBayarGroup = document.getElementById("buktiBayarGroup");
    const buktiBayarInput = document.getElementById("buktiBayar");

    if (total === 0) {
        buktiBayarInput.removeAttribute("required");
        buktiBayarInput.value = "";
        if (buktiBayarGroup) buktiBayarGroup.style.display = "none";
    } else {
        buktiBayarInput.setAttribute("required", "required");
        if (buktiBayarGroup) buktiBayarGroup.style.display = "block";
    }
}
