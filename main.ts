// Mengimpor dependensi yang dibutuhkan.
// "dotenv/load" untuk memuat file .env.
// "grammy" untuk fungsionalitas bot Telegram.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { Bot, GrammyError, HttpError } from "https://deno.land/x/grammy@v1.25.1/mod.ts";

/**
 * Fungsi utama untuk menginisialisasi dan menjalankan bot.
 * Menggunakan fungsi async memungkinkan kita menggunakan 'await' di level atas.
 */
async function main() {
  // 1. Ambil Token dari Environment
  //    Kode ini membaca variabel BOT_TOKEN dari file .env Anda.
  const token = Deno.env.get("BOT_TOKEN");
  if (!token) {
    console.error("Kesalahan: Variabel BOT_TOKEN tidak ditemukan. Pastikan file .env sudah ada dan berisi token Anda.");
    Deno.exit(1); // Keluar dari program jika token tidak ada.
  }

  // 2. Inisialisasi Bot
  //    Membuat instance bot baru menggunakan token yang didapat.
  const bot = new Bot(token);

  // 3. Daftarkan Perintah (Command)
  //    Bot akan merespons pesan "/start" dengan pesan sambutan.
  bot.command("start", (ctx) => {
    ctx.reply("Halo! Bot sudah aktif dan berjalan.");
  });
  
  // Anda bisa menambahkan command atau handler lain di sini.
  // bot.on("message:text", (ctx) => ctx.reply("Anda mengirim pesan teks!"));

  // 4. Atur Penanganan Error (Error Handling)
  //    Ini adalah praktik terbaik untuk menjaga bot tetap stabil jika terjadi error.
  bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Error saat menangani update ${ctx.update.update_id}:`);
    const e = err.error;

    if (e instanceof GrammyError) {
      console.error("Error di request Grammy:", e.description);
    } else if (e instanceof HttpError) {
      console.error("Tidak bisa terhubung ke Telegram:", e);
    } else {
      console.error("Error tidak diketahui:", e);
    }
  });

  // 5. Jalankan Bot
  //    Memulai bot untuk menerima update dari server Telegram.
  try {
    console.log("Memulai bot...");
    await bot.start();
  } catch (error) {
    console.error("Gagal memulai bot:", error);
    Deno.exit(1);
  }
}

// Panggil fungsi main untuk menjalankan seluruh proses.
main();