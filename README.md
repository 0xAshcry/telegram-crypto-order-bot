# Telegram Crypto Order Bot

MVP bot Telegram untuk jual-beli crypto nominal kecil dalam rupiah dengan alur pembayaran manual (QRIS / transfer bank), upload bukti transfer, verifikasi admin, dan dashboard admin web mini.

Project ini dibuat untuk belajar:
- Claude Code / AI coding workflow
- VS Code + terminal workflow
- Git + GitHub
- Node.js + TypeScript
- Express API
- PostgreSQL + Prisma
- Telegram Bot dengan Telegraf
- Admin dashboard sederhana

## Fitur Utama

### User / Customer
- /start
- /help
- /buy
- /ordersaya
- /detailorder <id>
- pilih coin via inline button
- pilih metode bayar via inline button
- upload foto bukti transfer
- lihat status order sendiri
- menerima notifikasi approve/reject dari admin

### Admin
- /adminpending
- /approve <orderId>
- /reject <orderId> <alasan>
- lihat log admin
- lihat alasan reject
- dashboard admin web mini di `/admin`

### Backend API
- health check
- create order
- get all orders
- get order detail
- upload proof image
- approve order
- reject order
- list pending verification

## Flow Bisnis Saat Ini

1. User membuat order
   - `paymentStatus = PENDING`
   - `orderStatus = WAITING_PAYMENT`

2. User upload bukti transfer
   - `paymentStatus = PENDING`
   - `orderStatus = WAITING_VERIFICATION`

3. Admin approve
   - `paymentStatus = PAID`
   - `orderStatus = APPROVED`

4. Admin reject
   - `paymentStatus = REJECTED`
   - `orderStatus = REJECTED`

Ini sengaja dibuat manual-verification dulu agar lebih aman untuk MVP dan pembelajaran.

## Tech Stack

- Node.js
- TypeScript
- Express
- Prisma ORM
- PostgreSQL
- Telegraf
- Multer
- HTML + CSS + Vanilla JS untuk dashboard admin mini

## Struktur Project

```bash
telegram-crypto-order-bot/
├── prisma/
│   ├── migrations/
│   └── schema.prisma
├── public/
│   └── admin/
│       ├── index.html
│       └── app.js
├── src/
│   ├── bot/
│   │   └── bot.ts
│   ├── config/
│   │   └── env.ts
│   ├── controllers/
│   │   └── order.controller.ts
│   ├── lib/
│   │   └── prisma.ts
│   ├── routes/
│   │   ├── index.ts
│   │   └── order.routes.ts
│   ├── services/
│   │   └── order.service.ts
│   ├── types/
│   │   └── order.ts
│   ├── utils/
│   │   └── response.ts
│   ├── app.ts
│   └── server.ts
├── uploads/
├── .env
├── package.json
├── tsconfig.json
└── README.md
```

## Database Schema Ringkas

### User
- id
- telegramId
- username
- createdAt

### Order
- id
- userId
- coinSymbol
- rupiahAmount
- estimatedCoinAmount
- paymentMethod
- paymentStatus
- orderStatus
- proofImageUrl
- rejectReason
- createdAt
- updatedAt

### AdminAction
- id
- orderId
- adminName
- actionType
- notes
- createdAt

## Environment Variables

Buat file `.env`:

```env
PORT=3000
NODE_ENV=development
TELEGRAM_BOT_TOKEN=ISI_TOKEN_BOT_KAMU
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/crypto_order_db"
ADMIN_TELEGRAM_IDS=6999175955
```

Keterangan:
- `TELEGRAM_BOT_TOKEN`: token dari BotFather
- `DATABASE_URL`: koneksi PostgreSQL
- `ADMIN_TELEGRAM_IDS`: daftar Telegram ID admin, pisahkan dengan koma jika lebih dari satu

Contoh:

```env
ADMIN_TELEGRAM_IDS=6999175955,123456789
```

## Setup Local Development

### 1. Clone repository

```bash
git clone git@github.com:0xAshcry/telegram-crypto-order-bot.git
cd telegram-crypto-order-bot
```

### 2. Install dependency

```bash
npm install
```

### 3. Siapkan database PostgreSQL

Kalau pakai Docker:

```bash
docker run -d \
  --name crypto-order-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=crypto_order_db \
  -p 5432:5432 \
  postgres:16
```

### 4. Isi file `.env`

Sesuaikan token Telegram dan admin ID.

### 5. Generate Prisma client dan migrate

```bash
npx prisma generate
npx prisma migrate dev --name init
```

Kalau repo baru pertama kali dijalankan setelah clone, Prisma akan menerapkan migration yang sudah ada.

### 6. Jalankan project

```bash
npm run dev
```

Server akan aktif di:
- API: `http://localhost:3000`
- Admin dashboard: `http://localhost:3000/admin`

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio
```

## Endpoint API

### Public / Core

```http
GET /api/health
POST /api/orders
GET /api/orders
GET /api/orders/:id
POST /api/orders/:id/upload-proof
```

### Admin

```http
GET /api/orders/pending
POST /api/orders/:id/approve
POST /api/orders/:id/reject
```

## Contoh Request API

### Create Order

```http
POST /api/orders
Content-Type: application/json
```

```json
{
  "telegramId": "6999175955",
  "username": "Xioaoxi",
  "coinSymbol": "USDT",
  "rupiahAmount": 20000,
  "paymentMethod": "QRIS"
}
```

### Approve Order

```http
POST /api/orders/3/approve
Content-Type: application/json
```

```json
{
  "adminName": "dashboard-admin"
}
```

### Reject Order

```http
POST /api/orders/3/reject
Content-Type: application/json
```

```json
{
  "adminName": "dashboard-admin",
  "notes": "bukti transfer blur"
}
```

## Telegram Commands

### User

```text
/start
/help
/buy
/ordersaya
/detailorder <id>
/cancel
/myid
```

### Admin

```text
/adminpending
/approve <orderId>
/reject <orderId> <alasan>
```

## Dashboard Admin Mini

Buka:

```text
http://localhost:3000/admin
```

Fitur dashboard:
- statistik order
- filter status
- pencarian order
- lihat detail order
- buka bukti transfer
- approve order
- reject order + alasan
- lihat admin logs

Catatan: dashboard ini masih belum punya login. Untuk production wajib ditambah auth.

## Catatan Keamanan

Project ini masih MVP pembelajaran. Hal-hal berikut belum production-ready:
- belum ada login/auth untuk dashboard admin
- belum ada rate limiting
- belum ada webhook verification / security hardening
- belum ada validasi file upload yang ketat
- belum ada QRIS dinamis
- belum ada integrasi exchange/wallet real
- belum ada KYC/AML
- belum ada audit/security review

Jangan langsung pakai project ini untuk transaksi crypto real tanpa penambahan keamanan dan kepatuhan legal.

## Roadmap Lanjutan

Beberapa ide pengembangan berikutnya:
- login sederhana untuk admin dashboard
- reject inline button dengan input alasan
- detail order via tombol inline
- upload bukti transfer lewat dashboard admin juga
- filter tanggal di dashboard
- notifikasi admin otomatis saat order baru masuk
- integrasi harga crypto real-time
- deploy ke VPS / Railway / Render
- Dockerfile + docker-compose
- test otomatis
- CI/CD GitHub Actions

## Status Project

Saat ini status project:
- backend API: jalan
- database Prisma/PostgreSQL: jalan
- bot Telegram: jalan
- order flow: jalan
- upload bukti transfer: jalan
- approve/reject admin: jalan
- log admin + alasan reject: jalan
- user order history: jalan
- detail order: jalan
- dashboard admin mini: jalan

## Lisensi

ISC

## Author

Git identity:
- Name: `0xashcry`
- Email: `aqsal.m@students.amikom.ac.id`
