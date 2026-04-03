import { promises as fs } from "fs";
import path from "path";
import { Markup, Telegraf } from "telegraf";
import { env } from "../config/env";
import {
  approveOrderService,
  createOrderService,
  getOrderByIdService,
  getPendingOrdersService,
  getUserOrdersService,
  rejectOrderService,
  uploadOrderProofService,
} from "../services/order.service";

type BuySession = {
  step:
    | "awaiting_coin"
    | "awaiting_amount"
    | "awaiting_payment_method"
    | "awaiting_proof_photo";
  coinSymbol?: "BTC" | "ETH" | "USDT";
  rupiahAmount?: number;
  orderId?: number;
  paymentMethod?: "QRIS" | "BANK_TRANSFER";
};

const buySessions = new Map<string, BuySession>();
const supportedCoins = ["BTC", "ETH", "USDT"] as const;
const supportedPayments = ["QRIS", "BANK_TRANSFER"] as const;
const adminTelegramIds = env.ADMIN_TELEGRAM_IDS.split(",")
  .map((id) => id.trim())
  .filter(Boolean);

const paymentInstructions = {
  QRIS: [
    "Metode pembayaran: QRIS",
    "Gunakan QRIS statis toko kamu di sini.",
    "Contoh penempatan nanti: tempel gambar QRIS / link QRIS merchant.",
    "Setelah transfer, kirim foto bukti pembayaran ke bot ini.",
  ].join("\n"),
  BANK_TRANSFER: [
    "Metode pembayaran: Transfer Bank",
    "Bank: BCA",
    "No. Rekening: 1234567890",
    "Atas Nama: Crypto Order Demo",
    "Setelah transfer, kirim foto bukti pembayaran ke bot ini.",
  ].join("\n"),
} as const;

export const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);

const mainKeyboard = Markup.keyboard([["/buy", "/ordersaya"], ["/help", "/cancel"]]).resize();
const coinKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback("BTC", "buy_coin:BTC"),
    Markup.button.callback("ETH", "buy_coin:ETH"),
    Markup.button.callback("USDT", "buy_coin:USDT"),
  ],
  [Markup.button.callback("Batal", "buy_cancel")],
]);
const paymentKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback("QRIS", "buy_payment:QRIS"),
    Markup.button.callback("BANK_TRANSFER", "buy_payment:BANK_TRANSFER"),
  ],
  [Markup.button.callback("Batal", "buy_cancel")],
]);
const ordersKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback("Refresh ordersaya", "orders_refresh")],
]);

const formatRupiah = (amount: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
};

const clearSession = (telegramId: string) => {
  buySessions.delete(telegramId);
};

const isAdmin = (telegramId: string) => {
  return adminTelegramIds.includes(telegramId);
};

const requireAdminAccess = async (telegramId: string, reply: (message: string) => Promise<unknown>) => {
  if (isAdmin(telegramId)) {
    return true;
  }

  await reply(
    [
      "Kamu bukan admin bot.",
      "Kirim command /myid lalu masukkan ID tersebut ke ADMIN_TELEGRAM_IDS di file .env.",
    ].join("\n")
  );

  return false;
};

const buildOrderSummary = ({
  id,
  coinSymbol,
  rupiahAmount,
  estimatedCoinAmount,
  paymentMethod,
  paymentStatus,
  orderStatus,
}: {
  id: number;
  coinSymbol: string;
  rupiahAmount: number;
  estimatedCoinAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
}) => {
  return [
    "Order berhasil dibuat.",
    "",
    `ID Order: ${id}`,
    `Coin: ${coinSymbol}`,
    `Nominal: ${formatRupiah(rupiahAmount)}`,
    `Estimasi coin: ${estimatedCoinAmount}`,
    `Metode bayar: ${paymentMethod}`,
    `Payment status: ${paymentStatus}`,
    `Order status: ${orderStatus}`,
  ].join("\n");
};

const buildUserOrderSummary = (orders: Awaited<ReturnType<typeof getUserOrdersService>>) => {
  if (orders.length === 0) {
    return "Kamu belum punya order. Gunakan /buy untuk membuat order baru.";
  }

  return orders
    .map((order) => {
      const latestAction = order.adminActions[0];

      return [
        `#${order.id} - ${order.coinSymbol}`,
        `Nominal: ${formatRupiah(order.rupiahAmount)}`,
        `Metode: ${order.paymentMethod}`,
        `Payment: ${order.paymentStatus}`,
        `Status: ${order.orderStatus}`,
        `Proof: ${order.proofImageUrl || "belum upload"}`,
        `Alasan reject: ${order.rejectReason || "-"}`,
        `Admin note terakhir: ${latestAction?.notes || "-"}`,
        `Detail: /detailorder ${order.id}`,
      ].join("\n");
    })
    .join("\n\n");
};

const buildDetailOrderSummary = (
  order: NonNullable<Awaited<ReturnType<typeof getOrderByIdService>>>
) => {
  const latestAction = order.adminActions[0];

  return [
    `Detail order #${order.id}`,
    "",
    `User: ${order.user.username || order.user.telegramId}`,
    `Coin: ${order.coinSymbol}`,
    `Nominal: ${formatRupiah(order.rupiahAmount)}`,
    `Estimasi coin: ${order.estimatedCoinAmount}`,
    `Metode pembayaran: ${order.paymentMethod}`,
    `Payment status: ${order.paymentStatus}`,
    `Order status: ${order.orderStatus}`,
    `Proof image: ${order.proofImageUrl || "belum upload"}`,
    `Reject reason: ${order.rejectReason || "-"}`,
    `Admin action terakhir: ${latestAction?.actionType || "-"}`,
    `Admin terakhir: ${latestAction?.adminName || "-"}`,
    `Catatan admin terakhir: ${latestAction?.notes || "-"}`,
    `Dibuat: ${new Date(order.createdAt).toLocaleString("id-ID")}`,
    `Diupdate: ${new Date(order.updatedAt).toLocaleString("id-ID")}`,
  ].join("\n");
};

const buildPendingOrderBlocks = async () => {
  const pendingOrders = await getPendingOrdersService();

  if (pendingOrders.length === 0) {
    return [] as Array<{ text: string; orderId: number }>;
  }

  return pendingOrders.slice(0, 10).map((order) => {
    const latestAction = order.adminActions[0];

    return {
      orderId: order.id,
      text: [
        `#${order.id} - ${order.coinSymbol}`,
        `User: ${order.user.username || order.user.telegramId}`,
        `Nominal: ${formatRupiah(order.rupiahAmount)}`,
        `Metode: ${order.paymentMethod}`,
        `Proof: ${order.proofImageUrl || "belum ada"}`,
        `Catatan terakhir: ${latestAction?.notes || order.rejectReason || "-"}`,
        `Approve manual: /approve ${order.id}`,
        `Reject manual: /reject ${order.id} alasan_kamu`,
      ].join("\n"),
    };
  });
};

const saveTelegramPhotoToUploads = async (fileUrl: string, orderId: number) => {
  const response = await fetch(fileUrl);

  if (!response.ok) {
    throw new Error("Gagal mengunduh file bukti transfer dari Telegram.");
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const filename = `proof-order-${orderId}-${Date.now()}.jpg`;
  const outputPath = path.join(process.cwd(), "uploads", filename);

  await fs.writeFile(outputPath, buffer);

  return `/uploads/${filename}`;
};

const notifyUserOrderDecision = async (telegramId: string, message: string) => {
  try {
    await bot.telegram.sendMessage(telegramId, message);
  } catch (error) {
    console.error("Gagal mengirim notifikasi ke user:", error);
  }
};

const sendUserOrders = async (
  telegramId: string,
  reply: (text: string, extra?: never) => Promise<unknown>
) => {
  const orders = await getUserOrdersService(telegramId);
  await reply(`Riwayat order kamu:\n\n${buildUserOrderSummary(orders)}`, ordersKeyboard as never);
};

bot.start(async (ctx) => {
  clearSession(String(ctx.from.id));

  await ctx.reply(
    `Selamat datang di Crypto Order Bot.

Gunakan command:
/buy - mulai order crypto
/ordersaya - lihat riwayat order kamu
/detailorder <id> - lihat detail satu order
/help - bantuan
/cancel - batalkan proses order
/myid - lihat Telegram ID kamu`,
    mainKeyboard
  );
});

bot.help(async (ctx) => {
  await ctx.reply(
    `Perintah yang tersedia:
/start
/help
/buy
/ordersaya
/detailorder <id>
/cancel
/myid

Perintah admin:
/adminpending
/approve <orderId>
/reject <orderId> <alasan>

Contoh reject:
/reject 5 bukti transfer blur

Alur order:
1. Klik tombol coin
2. Masukkan nominal rupiah
3. Klik tombol metode pembayaran
4. Bot simpan order ke database
5. Bot kirim instruksi pembayaran
6. User kirim foto bukti transfer
7. Admin approve/reject`,
    mainKeyboard
  );
});

bot.command("myid", async (ctx) => {
  await ctx.reply(`Telegram ID kamu: ${ctx.from.id}`);
});

bot.command("ordersaya", async (ctx) => {
  await sendUserOrders(String(ctx.from.id), (text, extra) => ctx.reply(text, extra));
});

bot.command("detailorder", async (ctx) => {
  const telegramId = String(ctx.from.id);
  const parts = ctx.message.text.trim().split(/\s+/);
  const orderId = Number(parts[1]);

  if (!Number.isInteger(orderId) || orderId <= 0) {
    await ctx.reply("Format salah. Gunakan: /detailorder <id>");
    return;
  }

  const order = await getOrderByIdService(orderId);

  if (!order) {
    await ctx.reply("Order tidak ditemukan.");
    return;
  }

  const isOwner = order.user.telegramId === telegramId;
  const hasAdminAccess = isAdmin(telegramId);

  if (!isOwner && !hasAdminAccess) {
    await ctx.reply("Kamu tidak punya akses ke detail order ini.");
    return;
  }

  await ctx.reply(buildDetailOrderSummary(order));
});

bot.command("cancel", async (ctx) => {
  clearSession(String(ctx.from.id));
  await ctx.reply("Proses order dibatalkan.", mainKeyboard);
});

bot.command("buy", async (ctx) => {
  buySessions.set(String(ctx.from.id), {
    step: "awaiting_coin",
  });

  await ctx.reply("Pilih coin yang ingin dibeli:", coinKeyboard);
});

bot.command("adminpending", async (ctx) => {
  const telegramId = String(ctx.from.id);

  if (!(await requireAdminAccess(telegramId, (message) => ctx.reply(message)))) {
    return;
  }

  const blocks = await buildPendingOrderBlocks();

  if (blocks.length === 0) {
    await ctx.reply("Tidak ada order yang sedang menunggu verifikasi.");
    return;
  }

  for (const block of blocks) {
    await ctx.reply(
      block.text,
      Markup.inlineKeyboard([
        [Markup.button.callback(`Approve #${block.orderId}`, `admin_approve:${block.orderId}`)],
      ])
    );
  }
});

bot.command("approve", async (ctx) => {
  const telegramId = String(ctx.from.id);

  if (!(await requireAdminAccess(telegramId, (message) => ctx.reply(message)))) {
    return;
  }

  const parts = ctx.message.text.trim().split(/\s+/);
  const orderId = Number(parts[1]);

  if (!Number.isInteger(orderId) || orderId <= 0) {
    await ctx.reply("Format salah. Gunakan: /approve <orderId>");
    return;
  }

  try {
    const order = await approveOrderService(orderId, ctx.from.username || String(ctx.from.id));
    const latestAction = order.adminActions[0];

    await ctx.reply(
      `Order #${order.id} berhasil di-approve.\nPayment status: ${order.paymentStatus}\nOrder status: ${order.orderStatus}\nAdmin log: ${latestAction?.actionType || "APPROVE"} oleh ${latestAction?.adminName || ctx.from.username || ctx.from.id}`
    );

    await notifyUserOrderDecision(
      order.user.telegramId,
      `Order #${order.id} sudah di-approve admin.\nCoin: ${order.coinSymbol}\nNominal: ${formatRupiah(order.rupiahAmount)}\nStatus: ${order.orderStatus}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal approve order.";
    await ctx.reply(`Approve gagal: ${message}`);
  }
});

bot.command("reject", async (ctx) => {
  const telegramId = String(ctx.from.id);

  if (!(await requireAdminAccess(telegramId, (message) => ctx.reply(message)))) {
    return;
  }

  const parts = ctx.message.text.trim().split(/\s+/);
  const orderId = Number(parts[1]);
  const reason = parts.slice(2).join(" ").trim();

  if (!Number.isInteger(orderId) || orderId <= 0) {
    await ctx.reply("Format salah. Gunakan: /reject <orderId> <alasan>");
    return;
  }

  if (!reason) {
    await ctx.reply("Alasan reject wajib diisi. Contoh: /reject 5 bukti transfer blur");
    return;
  }

  try {
    const adminName = ctx.from.username || String(ctx.from.id);
    const order = await rejectOrderService(orderId, adminName, reason);
    const latestAction = order.adminActions[0];

    await ctx.reply(
      `Order #${order.id} berhasil di-reject.\nPayment status: ${order.paymentStatus}\nOrder status: ${order.orderStatus}\nAlasan: ${order.rejectReason || reason}\nAdmin log: ${latestAction?.actionType || "REJECT"} oleh ${latestAction?.adminName || adminName}`
    );

    await notifyUserOrderDecision(
      order.user.telegramId,
      `Order #${order.id} ditolak admin.\nCoin: ${order.coinSymbol}\nNominal: ${formatRupiah(order.rupiahAmount)}\nStatus: ${order.orderStatus}\nAlasan: ${order.rejectReason || reason}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal reject order.";
    await ctx.reply(`Reject gagal: ${message}`);
  }
});

bot.action("buy_cancel", async (ctx) => {
  clearSession(String(ctx.from.id));
  await ctx.answerCbQuery("Proses order dibatalkan");
  await ctx.reply("Proses order dibatalkan.", mainKeyboard);
});

bot.action(/^buy_coin:(BTC|ETH|USDT)$/, async (ctx) => {
  const telegramId = String(ctx.from.id);
  const coinSymbol = ctx.match[1] as "BTC" | "ETH" | "USDT";

  buySessions.set(telegramId, {
    step: "awaiting_amount",
    coinSymbol,
  });

  await ctx.answerCbQuery(`Coin dipilih: ${coinSymbol}`);
  await ctx.reply(
    `Kamu memilih ${coinSymbol}. Sekarang masukkan nominal rupiah.
Contoh: 20000
Minimal pembelian: Rp10.000`,
    Markup.removeKeyboard()
  );
});

bot.action(/^buy_payment:(QRIS|BANK_TRANSFER)$/, async (ctx) => {
  const telegramId = String(ctx.from.id);
  const session = buySessions.get(telegramId);
  const paymentMethod = ctx.match[1] as "QRIS" | "BANK_TRANSFER";

  if (!session || session.step !== "awaiting_payment_method") {
    await ctx.answerCbQuery("Sesi order tidak ditemukan atau sudah kadaluarsa");
    await ctx.reply("Sesi order tidak ditemukan. Gunakan /buy untuk mulai lagi.", mainKeyboard);
    return;
  }

  try {
    const order = await createOrderService({
      telegramId,
      username: ctx.from.username,
      coinSymbol: session.coinSymbol || "USDT",
      rupiahAmount: session.rupiahAmount || 0,
      paymentMethod,
    });

    buySessions.set(telegramId, {
      step: "awaiting_proof_photo",
      orderId: order.id,
      coinSymbol: session.coinSymbol,
      rupiahAmount: session.rupiahAmount,
      paymentMethod,
    });

    await ctx.answerCbQuery(`Metode dipilih: ${paymentMethod}`);
    await ctx.reply(buildOrderSummary(order), mainKeyboard);
    await ctx.reply(paymentInstructions[paymentMethod]);
    await ctx.reply(
      `Setelah kamu bayar, kirim foto bukti transfer untuk order #${order.id} langsung ke chat ini.`
    );
  } catch (error) {
    clearSession(telegramId);
    const message = error instanceof Error ? error.message : "Gagal membuat order ke database.";
    await ctx.answerCbQuery("Gagal membuat order");
    await ctx.reply(`Gagal membuat order: ${message}`, mainKeyboard);
  }
});

bot.action("orders_refresh", async (ctx) => {
  await ctx.answerCbQuery("Memuat ulang ordersaya...");
  await sendUserOrders(String(ctx.from.id), (text, extra) => ctx.reply(text, extra));
});

bot.action(/^admin_approve:(\d+)$/, async (ctx) => {
  const telegramId = String(ctx.from.id);

  if (!(await requireAdminAccess(telegramId, (message) => ctx.reply(message)))) {
    await ctx.answerCbQuery("Kamu bukan admin");
    return;
  }

  const orderId = Number(ctx.match[1]);

  try {
    const order = await approveOrderService(orderId, ctx.from.username || String(ctx.from.id));
    const latestAction = order.adminActions[0];

    await ctx.answerCbQuery(`Order #${order.id} di-approve`);
    await ctx.reply(
      `Order #${order.id} berhasil di-approve.\nPayment status: ${order.paymentStatus}\nOrder status: ${order.orderStatus}\nAdmin log: ${latestAction?.actionType || "APPROVE"} oleh ${latestAction?.adminName || ctx.from.username || ctx.from.id}`
    );

    await notifyUserOrderDecision(
      order.user.telegramId,
      `Order #${order.id} sudah di-approve admin.\nCoin: ${order.coinSymbol}\nNominal: ${formatRupiah(order.rupiahAmount)}\nStatus: ${order.orderStatus}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal approve order.";
    await ctx.answerCbQuery("Approve gagal");
    await ctx.reply(`Approve gagal: ${message}`);
  }
});

bot.on("text", async (ctx) => {
  const telegramId = String(ctx.from.id);
  const session = buySessions.get(telegramId);
  const rawText = ctx.message.text.trim();
  const text = rawText.toUpperCase();

  if (!session) {
    return;
  }

  if (text === "/CANCEL") {
    clearSession(telegramId);
    await ctx.reply("Proses order dibatalkan.", mainKeyboard);
    return;
  }

  if (session.step === "awaiting_coin") {
    if (!supportedCoins.includes(text as (typeof supportedCoins)[number])) {
      await ctx.reply("Coin tidak valid. Silakan klik tombol coin yang tersedia di atas, atau /buy untuk ulangi.");
      return;
    }

    buySessions.set(telegramId, {
      step: "awaiting_amount",
      coinSymbol: text as "BTC" | "ETH" | "USDT",
    });

    await ctx.reply(
      `Kamu memilih ${text}. Sekarang masukkan nominal rupiah.
Contoh: 20000
Minimal pembelian: Rp10.000`
    );

    return;
  }

  if (session.step === "awaiting_amount") {
    const numericAmount = Number(rawText.replace(/[^0-9]/g, ""));

    if (!Number.isInteger(numericAmount) || numericAmount < 10000) {
      await ctx.reply("Nominal tidak valid. Masukkan angka minimal 10000.");
      return;
    }

    buySessions.set(telegramId, {
      ...session,
      step: "awaiting_payment_method",
      rupiahAmount: numericAmount,
    });

    await ctx.reply(
      `Nominal kamu ${formatRupiah(numericAmount)}.
Sekarang pilih metode pembayaran:`,
      paymentKeyboard
    );

    return;
  }

  if (session.step === "awaiting_payment_method") {
    if (!supportedPayments.includes(text as (typeof supportedPayments)[number])) {
      await ctx.reply("Metode pembayaran tidak valid. Silakan klik tombol QRIS atau BANK_TRANSFER.", paymentKeyboard);
      return;
    }

    try {
      const order = await createOrderService({
        telegramId,
        username: ctx.from.username,
        coinSymbol: session.coinSymbol || "USDT",
        rupiahAmount: session.rupiahAmount || 0,
        paymentMethod: text as "QRIS" | "BANK_TRANSFER",
      });

      buySessions.set(telegramId, {
        step: "awaiting_proof_photo",
        orderId: order.id,
        coinSymbol: session.coinSymbol,
        rupiahAmount: session.rupiahAmount,
        paymentMethod: text as "QRIS" | "BANK_TRANSFER",
      });

      await ctx.reply(buildOrderSummary(order), mainKeyboard);
      await ctx.reply(paymentInstructions[text as keyof typeof paymentInstructions]);
      await ctx.reply(`Setelah kamu bayar, kirim foto bukti transfer untuk order #${order.id} langsung ke chat ini.`);
    } catch (error) {
      clearSession(telegramId);
      const message = error instanceof Error ? error.message : "Gagal membuat order ke database.";
      await ctx.reply(`Gagal membuat order: ${message}`, mainKeyboard);
    }

    return;
  }

  if (session.step === "awaiting_proof_photo") {
    await ctx.reply(
      `Order #${session.orderId} sedang menunggu foto bukti transfer.
Silakan kirim foto screenshot bukti bayar, atau /cancel untuk membatalkan proses.`
    );
  }
});

bot.on("photo", async (ctx) => {
  const telegramId = String(ctx.from.id);
  const session = buySessions.get(telegramId);

  if (!session || session.step !== "awaiting_proof_photo" || !session.orderId) {
    await ctx.reply(
      "Foto diterima, tapi tidak ada order yang sedang menunggu bukti transfer. Gunakan /buy untuk membuat order baru.",
      mainKeyboard
    );
    return;
  }

  try {
    const photos = ctx.message.photo;
    const largestPhoto = photos[photos.length - 1];
    const fileLink = await ctx.telegram.getFileLink(largestPhoto.file_id);
    const proofImageUrl = await saveTelegramPhotoToUploads(fileLink.toString(), session.orderId);
    const updatedOrder = await uploadOrderProofService(session.orderId, proofImageUrl);

    clearSession(telegramId);

    await ctx.reply(
      `Bukti transfer untuk order #${updatedOrder.id} berhasil disimpan.

Proof URL: ${proofImageUrl}
Payment status: ${updatedOrder.paymentStatus}
Order status: ${updatedOrder.orderStatus}

Pembayaran kamu belum dianggap lunas dulu. Admin akan memverifikasi bukti transfer ini secara manual.`,
      mainKeyboard
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menyimpan bukti transfer.";
    await ctx.reply(`Upload bukti transfer gagal: ${message}`, mainKeyboard);
  }
});
