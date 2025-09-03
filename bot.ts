import { Bot, Context, GrammyError, InlineKeyboard, session, SessionFlavor } from "https://deno.land/x/grammy@v1.19.2/mod.ts";
import "https://deno.land/std@0.224.0/dotenv/load.ts";

// =======================
// TYPES & INTERFACES
// =======================
interface SessionData {
  customer_name?: string;
  cart: Record<string, number>;
  current_view: string;
  total: number;
}

interface Sale {
  timestamp: string;
  cashier_id: number;
  customer_name: string;
  items: Record<string, number>;
  total: number;
  payment_method: string;
}

type MyContext = Context & SessionFlavor<SessionData>;

// =======================
// CONSTANTS & CONFIG
// =======================
const TOKEN = Deno.env.get("BOT_TOKEN") || "";

function parseIdSet(envVar: string | undefined): Set<number> {
  if (!envVar) return new Set();
  return new Set(
    envVar
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .map(Number)
      .filter((id) => !isNaN(id))
  );
}

const ADMIN_IDS = parseIdSet(Deno.env.get("ADMIN_IDS"));
const USER_IDS = parseIdSet(Deno.env.get("USER_IDS"));

const MENU: Record<string, number> = {
  "🍵 Matcha OG": 14000,
  "🍓 Strawberry Matcha": 16000,
  "🍪 Matcha Cookies": 17000,
  "🍫 Choco Matcha": 16000,
  "☁️ Matcha Cloud": 15000,
  "🍯 Honey Matcha": 15000,
  "🥥 Coconut Matcha": 15000,
  "🍊 Orange Matcha": 14000,
};

// Views
const VIEW_WELCOME = "welcome";
const VIEW_GETTING_NAME = "getting_name";
const VIEW_MENU = "menu";
const VIEW_ITEM_DETAIL = "item_detail";
const VIEW_CHECKOUT = "checkout";
const VIEW_WAITING_CASH = "waiting_cash";
const VIEW_QRIS = "qris";
const VIEW_POST_TRANSACTION = "post_transaction";
const VIEW_ADMIN_PANEL = "admin_panel";
const VIEW_ADMIN_REKAP = "admin_rekap";

// Global sales data
const SALES: Sale[] = [];

// =======================
// UTILITY FUNCTIONS
// =======================
function isAuthorized(uid: number): boolean {
  return ADMIN_IDS.has(uid) || USER_IDS.has(uid);
}

function isAdmin(uid: number): boolean {
  return ADMIN_IDS.has(uid);
}

function formatCurrency(amount: number): string {
  return `Rp${amount.toLocaleString("id-ID")}`;
}

function cleanNumericInput(text: string): number | null {
  try {
    const cleanText = text
      .replace(/\./g, "")
      .replace(/,/g, "")
      .replace(/\s/g, "")
      .toLowerCase()
      .replace("rp", "");
    
    if (cleanText.match(/^\d+$/) && cleanText.length < 10) {
      return parseInt(cleanText);
    }
    return null;
  } catch {
    return null;
  }
}

function calculateCartTotal(cart: Record<string, number>): number {
  return Object.entries(cart).reduce((total, [item, qty]) => {
    return total + (MENU[item] || 0) * qty;
  }, 0);
}

function updateCart(cart: Record<string, number>, item: string, action: string): Record<string, number> {
  const newCart = { ...cart };
  const currentQty = newCart[item] || 0;

  if (action === "inc") {
    newCart[item] = currentQty + 1;
  } else if (action === "dec" && currentQty > 0) {
    newCart[item] = currentQty - 1;
    if (newCart[item] === 0) {
      delete newCart[item];
    }
  }

  return newCart;
}

function generateCartSummaryText(cart: Record<string, number>): string {
  if (Object.keys(cart).length === 0) {
    return "Keranjang kosong.";
  }
  return Object.entries(cart)
    .map(([item, qty]) => `• ${item} x${qty} = ${formatCurrency((MENU[item] || 0) * qty)}`)
    .join("\n");
}

// =======================
// KEYBOARD BUILDERS
// =======================
function buildWelcomeKeyboard(uid: number): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text("✅ Mulai Sesi Transaksi", "start_transaction");
  
  if (isAdmin(uid)) {
    keyboard.row().text("🔧 Admin Panel", "admin_panel");
  }
  
  return keyboard;
}

function buildMenuKeyboard(uid: number): InlineKeyboard {
  const menuItems = Object.keys(MENU);
  const keyboard = new InlineKeyboard();

  // Add menu items in pairs
  for (let i = 0; i < menuItems.length; i += 2) {
    keyboard.text(menuItems[i], `item_${menuItems[i]}`);
    if (i + 1 < menuItems.length) {
      keyboard.text(menuItems[i + 1], `item_${menuItems[i + 1]}`);
    }
    keyboard.row();
  }

  keyboard.text("🛒 Checkout", "checkout");
  
  if (isAdmin(uid)) {
    keyboard.row().text("🔧 Admin Panel", "admin_panel");
  }

  return keyboard;
}

function buildItemKeyboard(item: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("➖", `dec_${item}`)
    .text("➕", `inc_${item}`)
    .row()
    .text("⬅️ Kembali ke Menu", "back_to_menu");
}

function buildPaymentKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("💵 Cash", "pay_cash")
    .text("📱 QRIS", "pay_qris")
    .row()
    .text("⬅️ Kembali ke Menu", "back_to_menu");
}

function buildQrisKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Pembayaran Selesai", "qris_done")
    .row()
    .text("❌ Batal", "back_to_checkout");
}

function buildAdminKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📊 Rekap Penjualan", "adm_rekap")
    .row()
    .text("🗑️ Reset Data Harian", "adm_reset")
    .row()
    .text("🔙 Halaman Utama", "end_session");
}

function buildPostTransactionKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("👤 Pelanggan Baru", "new_customer")
    .row()
    .text("➕ Tambah Item (Pelanggan Sama)", "continue_same_customer")
    .row()
    .text("🚪 Selesai Sesi (Tutup Toko)", "end_session");
}

// =======================
// VIEW FUNCTIONS
// =======================
async function showWelcomeScreen(ctx: MyContext) {
  const uid = ctx.from?.id!;
  ctx.session.current_view = VIEW_WELCOME;
  const text = "🍵 *Selamat Datang di Matcha Kasir Bot!*\n\nSilakan mulai sesi untuk mencatat transaksi.";
  
  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, {
      reply_markup: buildWelcomeKeyboard(uid),
      parse_mode: "Markdown"
    });
  } else {
    await ctx.reply(text, {
      reply_markup: buildWelcomeKeyboard(uid),
      parse_mode: "Markdown"
    });
  }
}

async function showMainMenu(ctx: MyContext) {
  const uid = ctx.from?.id!;
  ctx.session.current_view = VIEW_MENU;
  
  const cartSummary = generateCartSummaryText(ctx.session.cart);
  const totalText = formatCurrency(calculateCartTotal(ctx.session.cart));
  
  const text = `👤 *Pelanggan: ${ctx.session.customer_name}*\n\n` +
    `🛒 *Keranjang Saat Ini:*\n${cartSummary}\n\n` +
    `💰 *Total Sementara: ${totalText}*\n\n` +
    "Silakan pilih item:";

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, {
        reply_markup: buildMenuKeyboard(uid),
        parse_mode: "Markdown"
      });
    } catch (e) {
      // cek apakah ini error "message is not modified"
      if (e instanceof GrammyError && e.description.includes("message is not modified")) {
        // Jika iya, abaikan error ini. Tidak perlu melakukan apa-apa.
        console.log("Caught 'message is not modified' error, ignoring.");
      } else {
        throw e; // Jika bukan, lempar error kembali
      }
    }
  } else {
    await ctx.reply(text, {
      reply_markup: buildMenuKeyboard(uid),
      parse_mode: "Markdown"
    });
  }
}

function resetUserSession(session: SessionData, fullReset: boolean = false) {
  if (fullReset) {
    session.customer_name = undefined;
    session.cart = {};
    session.current_view = VIEW_WELCOME;
    session.total = 0;
  } else {
    session.customer_name = undefined;
    session.cart = {};
    session.total = 0;
  }
}

function generateSalesReport(): string {
  if (SALES.length === 0) {
    return "📊 *Rekap Penjualan*\n\nBelum ada transaksi hari ini.";
  }

  const itemSummary: Record<string, number> = {};
  let totalRevenue = 0;
  let cashTotal = 0;
  let qrisTotal = 0;

  for (const sale of SALES) {
    totalRevenue += sale.total;
    if (sale.payment_method === "Cash") {
      cashTotal += sale.total;
    } else {
      qrisTotal += sale.total;
    }
    
    for (const [item, qty] of Object.entries(sale.items)) {
      itemSummary[item] = (itemSummary[item] || 0) + qty;
    }
  }

  const itemLines = Object.entries(itemSummary)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([item, qty]) => `• ${item} x${qty}`);

  return `📊 *Rekap Penjualan Hari Ini*\n\n` +
    `*Penjualan Item:*\n${itemLines.join("\n")}\n\n` +
    `📈 Total Transaksi: ${SALES.length}\n` +
    `💵 Cash: ${formatCurrency(cashTotal)}\n` +
    `📱 QRIS: ${formatCurrency(qrisTotal)}\n` +
    `💰 *Total Omzet: ${formatCurrency(totalRevenue)}*`;
}

async function processAndShowReceipt(ctx: MyContext, method: string, cashReceived: number = 0) {
  const uid = ctx.from?.id!;
  
  // Save transaction
  const transaction: Sale = {
    timestamp: new Date().toISOString(),
    cashier_id: uid,
    customer_name: ctx.session.customer_name!,
    items: ctx.session.cart,
    total: ctx.session.total,
    payment_method: method
  };
  
  SALES.push(transaction);
  console.log(`Transaction saved: ${ctx.session.customer_name} - ${formatCurrency(ctx.session.total)}`);

  // Generate receipt text
  const cartSummary = generateCartSummaryText(ctx.session.cart);
  let receipt = `🧾 *STRUK PEMBAYARAN*\n${"=".repeat(25)}\n` +
    `👤 Pelanggan: ${ctx.session.customer_name}\n` +
    `📅 Waktu: ${new Date().toLocaleString("id-ID")}\n` +
    `💳 Metode: ${method}\n\n` +
    `🛍️ *Pesanan:*\n${cartSummary}\n\n` +
    `💰 *Total: ${formatCurrency(ctx.session.total)}*`;

  if (method === "Cash") {
    const change = cashReceived - ctx.session.total;
    receipt += `\n💵 Tunai: ${formatCurrency(cashReceived)}\n💸 Kembalian: ${formatCurrency(change)}`;
  }
  
  receipt += `\n\n✅ *LUNAS*\n${"=".repeat(25)}`;

  ctx.session.current_view = VIEW_POST_TRANSACTION;

  if (ctx.callbackQuery) {
    await ctx.editMessageText(receipt, { parse_mode: "Markdown" });
    await ctx.reply("Pilih langkah selanjutnya:", {
      reply_markup: buildPostTransactionKeyboard()
    });
  } else {
    await ctx.reply(receipt, { parse_mode: "Markdown" });
    await ctx.reply("Pilih langkah selanjutnya:", {
      reply_markup: buildPostTransactionKeyboard()
    });
  }
}

// =======================
// BOT SETUP
// =======================
const bot = new Bot<MyContext>(TOKEN);

// Session middleware
bot.use(session({
  initial: (): SessionData => ({
    cart: {},
    current_view: VIEW_WELCOME,
    total: 0,
  }),
}));

// =======================
// COMMAND HANDLERS
// =======================
bot.command("start", async (ctx) => {
  const uid = ctx.from?.id;
  if (!uid || !isAuthorized(uid)) {
    await ctx.reply("🚫 *Akses Ditolak*. Anda tidak terdaftar.", { parse_mode: "Markdown" });
    return;
  }

  resetUserSession(ctx.session, true);
  await showWelcomeScreen(ctx);
});

// =======================
// TEXT MESSAGE HANDLER
// =======================
bot.on("message:text", async (ctx) => {
  const uid = ctx.from?.id;
  if (!uid || !isAuthorized(uid)) return;

  const view = ctx.session.current_view;
  const text = ctx.message.text.trim();

  if (view === VIEW_GETTING_NAME) {
    if (!text || text.length < 2 || text.length > 50) {
      await ctx.reply("❌ Nama tidak valid (min 2, maks 50 karakter). Coba lagi:");
      return;
    }
    ctx.session.customer_name = text;
    await showMainMenu(ctx);

  } else if (view === VIEW_WAITING_CASH) {
    const total = ctx.session.total;
    const cashAmount = cleanNumericInput(text);
    
    if (cashAmount === null) {
      await ctx.reply(`❌ Format tidak valid. Masukkan angka saja.\nTotal: ${formatCurrency(total)}`);
      return;
    }
    
    if (cashAmount < total) {
      await ctx.reply(`💰 Uang kurang. Dibutuhkan ${formatCurrency(total - cashAmount)} lagi.`);
      return;
    }
    
    await processAndShowReceipt(ctx, "Cash", cashAmount);

  } else {
    await ctx.reply("ℹ️ Silakan gunakan tombol yang tersedia atau /start untuk memulai ulang.");
  }
});

// =======================
// CALLBACK QUERY HANDLERS
// =======================
bot.on("callback_query", async (ctx) => {
  await ctx.answerCallbackQuery();
  
  const uid = ctx.from?.id;
  if (!uid || !isAuthorized(uid)) {
    await ctx.answerCallbackQuery("🚫 Akses Ditolak!");
    return;
  }

  const data = ctx.callbackQuery.data;
  
  // Navigation & Session Control
  if (data === "start_transaction") {
    resetUserSession(ctx.session, false);
    ctx.session.current_view = VIEW_GETTING_NAME;
    await ctx.editMessageText("👤 Silakan masukkan *nama pelanggan*:", { parse_mode: "Markdown" });
    
  } else if (data === "end_session") {
    resetUserSession(ctx.session, true);
    await showWelcomeScreen(ctx);
    
  } else if (data === "new_customer") {
    resetUserSession(ctx.session, false);
    ctx.session.current_view = VIEW_GETTING_NAME;
    await ctx.editMessageText("👤 Silakan masukkan *nama pelanggan berikutnya*:", { parse_mode: "Markdown" });

  } else if (data === "continue_same_customer") {
    await showMainMenu(ctx);

  } else if (data === "back_to_menu") {
    await showMainMenu(ctx);
    
  // Item & Cart Management
  } else if (typeof data === "string" && data.startsWith("item_")) {
    const item = data.slice(5); // Remove "item_" prefix
    ctx.session.current_view = VIEW_ITEM_DETAIL;
    const price = MENU[item] || 0;
    const qty = ctx.session.cart[item] || 0;
    const text = `🛍️ *${item}*\n\n` +
      `💰 Harga: ${formatCurrency(price)}\n` +
      `🔢 Jumlah: ${qty}\n` +
      `💵 Subtotal: ${formatCurrency(price * qty)}`;
    
    await ctx.editMessageText(text, {
      reply_markup: buildItemKeyboard(item),
      parse_mode: "Markdown"
    });

  } else if (typeof data === "string" && (data.startsWith("inc_") || data.startsWith("dec_"))) {
    const [action, item] = data.split("_", 2);
    ctx.session.cart = updateCart(ctx.session.cart, item, action);
    
    // Re-render item detail view
    const price = MENU[item] || 0;
    const qty = ctx.session.cart[item] || 0;
    const text = `🛍️ *${item}*\n\n` +
      `💰 Harga: ${formatCurrency(price)}\n` +
      `🔢 Jumlah: ${qty}\n` +
      `💵 Subtotal: ${formatCurrency(price * qty)}`;
    
    await ctx.editMessageText(text, {
      reply_markup: buildItemKeyboard(item),
      parse_mode: "Markdown"
    });

  // Checkout & Payment
  } else if (data === "checkout") {
    if (Object.keys(ctx.session.cart).length === 0) {
      await ctx.answerCallbackQuery("🛒 Keranjang kosong!");
      return;
    }
    
    ctx.session.total = calculateCartTotal(ctx.session.cart);
    ctx.session.current_view = VIEW_CHECKOUT;
    const cartSummary = generateCartSummaryText(ctx.session.cart);
    
    const text = `🧾 *Ringkasan Pesanan*\n\n` +
      `👤 Pelanggan: ${ctx.session.customer_name}\n\n` +
      `🛍️ *Items:*\n${cartSummary}\n\n` +
      `💰 *Total: ${formatCurrency(ctx.session.total)}*\n\n` +
      "Pilih metode pembayaran:";
    
    await ctx.editMessageText(text, {
      reply_markup: buildPaymentKeyboard(),
      parse_mode: "Markdown"
    });

  } else if (data === "back_to_checkout") {
    // Re-trigger checkout
    ctx.callbackQuery.data = "checkout";
    await bot.handleUpdate({
      update_id: 0,
      callback_query: ctx.callbackQuery
    } as any);
    
  } else if (data === "pay_cash") {
    ctx.session.current_view = VIEW_WAITING_CASH;
    const text = `💵 *Pembayaran Tunai*\n\n` +
      `💰 Total: ${formatCurrency(ctx.session.total)}\n\n` +
      "Ketik nominal uang yang diterima:";
    
    await ctx.editMessageText(text, { parse_mode: "Markdown" });

  } else if (data === "pay_qris") {
    ctx.session.current_view = VIEW_QRIS;
    const text = `📱 *Pembayaran QRIS*\n\n` +
      `💰 Total: ${formatCurrency(ctx.session.total)}\n\n` +
      "🔲 Silakan scan QRIS dan konfirmasi pembayaran.";
    
    await ctx.editMessageText(text, {
      reply_markup: buildQrisKeyboard(),
      parse_mode: "Markdown"
    });
    
  } else if (data === "qris_done") {
    await processAndShowReceipt(ctx, "QRIS");

  // Admin Panel
  } else if (data === "admin_panel") {
    if (!isAdmin(uid)) return;
    
    ctx.session.current_view = VIEW_ADMIN_PANEL;
    await ctx.editMessageText("🔧 *Panel Admin*", {
      reply_markup: buildAdminKeyboard(),
      parse_mode: "Markdown"
    });

  } else if (data === "adm_rekap") {
    if (!isAdmin(uid)) return;
    
    ctx.session.current_view = VIEW_ADMIN_REKAP;
    const reportText = generateSalesReport();
    
    await ctx.editMessageText(reportText, {
      reply_markup: new InlineKeyboard().text("🔙 Kembali", "admin_panel"),
      parse_mode: "Markdown"
    });

  } else if (data === "adm_reset") {
    if (!isAdmin(uid)) return;
    
    SALES.length = 0; // Clear array
    console.log(`Data reset by admin ${uid}`);
    
    await ctx.editMessageText("🗑️ *Data Penjualan Harian Berhasil Direset*", {
      reply_markup: new InlineKeyboard().text("🔙 Kembali", "admin_panel"),
      parse_mode: "Markdown"
    });
  }
});

// =======================
// ERROR HANDLING
// =======================
bot.catch((err) => {
  console.error("Bot error:", err);
});

// =======================
// START BOT
// =======================
console.log("🚀 Starting Bot Kasir...");
bot.start();