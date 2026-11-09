# Disaster Relief Crowdfunding Smart Contract

Repositori ini memuat implementasi *smart contract* berbasis **Solidity** dan framework **Hardhat 3** untuk platform prototipe *Disaster Relief Crowdfunding* (Penggalangan Dana Bencana Transparan). Sistem ini dirancang dengan pendekatan hibrida (*Fiat-to-Blockchain*), di mana pembayaran donasi menggunakan mata uang rupiah melalui Payment Gateway lokal (Midtrans) dan setiap transaksi divalidasi serta direkam secara permanen ke jaringan blockchain Ethereum sebagai *immutable audit trail*.

Projek ini dikembangkan sebagai bagian dari Mata Kuliah **Teknologi Blockchain dan Platform Keuangan Digital**, Program Studi Teknologi Informasi, Fakultas Ilmu Komputer, Universitas Brawijaya.

---

## 📌 Daftar Isi
1. [Gambaran Umum & Cara Kerja](#-gambaran-umum--cara-kerja)
2. [Fitur Utama Smart Contract](#-fitur-utama-smart-contract)
3. [Arsitektur & Aktor Sistem](#-arsitektur--aktor-sistem)
4. [Prasyarat Sistem (Prerequisites)](#-prasyarat-sistem-prerequisites)
5. [Panduan Instalasi di Komputer Baru (Quickstart)](#-panduan-instalasi-di-komputer-baru-quickstart)
6. [Kompilasi & Menjalankan Pengujian](#-kompilasi--menjalankan-pengujian)
7. [Simulasi Jaringan Lokal (Local Node)](#-simulasi-jaringan-lokal-local-node)
8. [Struktur Direktori Repositori](#-struktur-direktori-repositori)

---

## 📖 Gambaran Umum & Cara Kerja

Platform crowdfunding bencana biasa sering menghadapi masalah ketidakjelasan alokasi dana dan kecurigaan manipulasi data pada basis data terpusat (*centralized database*). Kontrak pintar `DisasterCrowdfunding.sol` menyelesaikan masalah ini dengan bertindak sebagai buku kas digital publik (*trustless & tamper-proof ledger*).

### Alur Kerja Transaksi:
1. **Pembuatan Kampanye (`createCampaign`)**: Inisiator bencana (NGO/relawan) mendaftarkan kampanye tanggap darurat. Setelah dokumen legalitas diverifikasi secara *off-chain*, server *backend relayer* mendaftarkan kampanye ke smart contract.
2. **Pencatatan Donasi Masuk (`donateToCampaign`)**: Donatur menyalurkan bantuan menggunakan fiat Rupiah melalui Midtrans (QRIS, VA Bank, E-Wallet). Ketika webhook Midtrans mengonfirmasi pembayaran berstatus *settlement/success*, *Backend Relayer* secara otomatis memanggil fungsi ini. Saldo `danaTerkumpul` diperbarui dan memancarkan *event* `DonationReceived` yang menghasilkan *hash* transaksi unik.
3. **Pencairan Dana Terverifikasi (`withdrawDisbursement`)**: Saat bantuan logistik siap disalurkan ke lapangan, inisiator kampanye mengajukan pencairan dengan melampirkan tautan/hash bukti fisik (seperti kwitansi pembelian beras/tenda, foto serah terima di IPFS/cloud). Kontrak memvalidasi kecukupan sisa saldo kampanye dan mengunci catatan pencairan tersebut selamanya di blockchain.

---

## ⚙️ Fitur Utama Smart Contract

* **Role-Based Access Control (`Ownable`)**: Membatasi fungsi sensitif (seperti registrasi kampanye dan pencatatan saldo donasi) agar hanya dapat dieksekusi oleh alamat server backend resmi (*authorized relayer*).
* **Multi-Campaign Isolation**: Setiap kampanye bencana memiliki ID, target dana, dompet alokasi, serta pembukuan saldo masing-masing untuk mencegah percampuran dana bantuan antar-bencana.
* **Disbursement with Proof of Action**: Inisiator wajib melampirkan URI bukti fisik pada setiap aksi pencairan dana. Riwayat penarikan disimpan dalam *array* `campaignDisbursements` yang dapat diaudit publik.
* **Proteksi Keamanan Anti-Reentrancy (`ReentrancyGuard`)**: Mencegah eksploitasi celah penarikan dana berulang (*re-entrancy attack*).
* **Audit Trail Events**: Menerbitkan event log (`CampaignCreated`, `DonationReceived`, `DisbursementExecuted`) untuk kemudahan pelacakan di block explorer (misal: Etherscan).

---

## 👥 Arsitektur & Aktor Sistem

| Peran / Komponen | Deskripsi |
| :--- | :--- |
| **Owner (Deployer)** | Pemilik kontrak yang berwenang menunjuk atau mengganti alamat Backend Relayer. |
| **Backend Relayer** | Alamat *signer* otomatis server Node.js yang bertugas menjembatani event sukses Midtrans ke blockchain. |
| **Inisiator Bencana** | Lembaga kemanusiaan berwenang yang memiliki hak eksklusif mencairkan dana kampanye miliknya. |
| **Donatur & Publik** | Pengguna yang memberikan donasi fiat dan dapat memverifikasi riwayat transaksi secara independen (*self-service audit*). |

---

## 💻 Prasyarat Sistem (Prerequisites)

Sebelum mengkloning repositori ini ke komputer baru, pastikan perangkat telah terpasang:
* **Node.js**: Versi `^20.x` atau LTS terbaru ([Unduh Node.js](https://nodejs.org/))
* **npm**: Versi `^9.x` atau lebih baru
* **Git**: Versi terbaru

Pastikan instalasi berhasil dengan memeriksa versi di terminal:
```bash
node -v
npm -v
git -v
```

---

## 🚀 Panduan Instalasi di Komputer Baru (Quickstart)

Ikuti langkah-langkah berikut untuk menginisialisasi projek pada komputer atau lingkungan kerja yang baru:

### 1. Kloning Repositori
```bash
git clone https://github.com/FazriS/disaster-crowdfunding.git
cd disaster-crowdfunding
```

### 2. Pasang Dependensi
Pasang seluruh pustaka pengembangan (Hardhat 3, OpenZeppelin, Ethers.js, TypeScript, Chai):
```bash
npm install
```

### 3. Siapkan Konfigurasi Lingkungan (`.env`)
Salin atau buat file `.env` di root folder projek:
```bash
touch .env
```
Isi variabel berikut jika nantinya ingin melakukan deployment ke testnet:
```env
SEPOLIA_RPC_URL="https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY"
PRIVATE_KEY="YOUR_WALLET_PRIVATE_KEY"
ETHERSCAN_API_KEY="YOUR_ETHERSCAN_API_KEY"
```

---

## 🧪 Kompilasi & Menjalankan Pengujian

### 1. Kompilasi Kontrak Pintar
Jalankan kompilator Solidity bawaan Hardhat:
```bash
npx hardhat compile
```
Jika berhasil, artefak kontrak dan file ABI akan terbentuk di folder `artifacts/contracts/DisasterCrowdfunding.sol/DisasterCrowdfunding.json`.

### 2. Jalankan Pengujian Unit Otomatis (Automated Tests)
Pengujian mencakup skenario pembuatan kampanye, donasi sukses, penolakan akses ilegal, dan validasi limit saldo pencairan:
```bash
npx hardhat test
```
*Output yang diharapkan: seluruh 6 pengujian berstatus passing (berwarna hijau).*

---

## 🌐 Simulasi Jaringan Lokal (Local Node)

Jika Anda ingin menguji interaksi kontrak dengan backend API Node.js/Express secara offline tanpa kuota gas:

1. **Jalankan node blockchain lokal**:
   ```bash
   npx hardhat node
   ```
   Terminal akan menjalankan node RPC di `http://127.0.0.1:8545` dan menyediakan 20 akun pengujian lengkap dengan *private key* dan saldo masing-masing 10.000 ETH.

2. **Deploy kontrak ke jaringan lokal**:
   Buka jendela terminal baru, lalu jalankan:
   ```bash
   npx hardhat ignition deploy ./ignition/modules/DisasterCrowdfunding.ts --network localhost
   ```

