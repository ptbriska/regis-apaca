document.addEventListener("DOMContentLoaded", () => {
    const totalDisplay = document.getElementById("totalDisplay");
    const totalValue = document.getElementById("totalValue");
    const lokasiInput = document.getElementById("lokasi");
    
    // 1. Deteksi Lokasi Otomatis (via IP API publik gratis)
    fetch('https://ipapi.co/json/')
        .then(response => response.json())
        .then(data => {
            lokasiInput.value = `${data.city}, ${data.region} (${data.country_name})`;
        })
        .catch(err => {
            lokasiInput.value = "Gagal mendeteksi lokasi. Silakan isi manual.";
            lokasiInput.removeAttribute("readonly");
        });

    // 2. Fetch Katalog Produk (data.json)
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            renderCheckboxes(data.single_modules, "singleModulesContainer");
            renderCheckboxes(data.bundling_modules, "bundlingModulesContainer");
        });

    function renderCheckboxes(items, containerId) {
        const container = document.getElementById(containerId);
        items.forEach(item => {
            const label = document.createElement("label");
            label.className = "checkbox-item";
            
            const formatter = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0});
            const formattedPrice = item.harga === 0 ? "Gratis" : formatter.format(item.harga);

            label.innerHTML = `
                <div>
                    <input type="checkbox" name="produk[]" value="${item.id}" data-harga="${item.harga}" onchange="calculateTotal()">
                    <span class="item-name">${item.nama}</span>
                </div>
                <span class="item-price">${formattedPrice}</span>
            `;
            container.appendChild(label);
        });
    }

    // 3. Tangani Submit Form (Menembak ke Google Apps Script)
    document.getElementById("registrationForm").addEventListener("submit", function(e) {
        e.preventDefault();
        
        // --- DI SINI LOGIKA POST KE GOOGLE APPS SCRIPT (GAS) ---
        // Contoh penyiapan payload:
        // const formData = new FormData(this);
        // fetch("URL_WEB_APP_GAS_ANDA", { method: 'POST', body: formData })
        // .then(res => alert("Pendaftaran Berhasil! Cek email untuk Akses Key."))
        
        alert(`Pendaftaran disimulasikan sukses!\nTotal Bayar: Rp${totalValue.value}\nMenunggu integrasi ke GAS untuk auto-generate key.`);
    });
});

// Fungsi Kalkulasi Total Harga
function calculateTotal() {
    const checkboxes = document.querySelectorAll('input[name="produk[]"]:checked');
    let total = 0;
    checkboxes.forEach(box => {
        total += parseInt(box.getAttribute("data-harga"));
    });

    const formatter = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 });
    document.getElementById("totalDisplay").innerText = formatter.format(total);
    document.getElementById("totalValue").value = total;
}
