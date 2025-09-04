/**
 * Bot Telegram Sederhana untuk Deno
 *
 * Fitur:
 * - Memuat token dari file .env.
 * - Merespons perintah /start.
 * - Penanganan error yang tangguh.
 * - Graceful shutdown agar kompatibel dengan Deno Deploy.
 */

// 1. MENGIMPOR DEPENDENSI
// =======================================================
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { Bot, GrammyError, HttpError } from "https://deno.land/x/grammy@v1.25.1/mod.ts";

// 2. FUNGSI UTAMA (MAIN)
// =======================================================
async function main() {
  // Ambil token dari environment variables (.env).
  const token = Deno.env.get("BOT_TOKEN");
  if (!token) {
    console.error("Kesalahan: Variabel BOT_TOKEN tidak ditemukan di file .env.");
    Deno.exit(1);
  }

  // Buat instance bot baru.
  const bot = new Bot(token);

  // 3. HANDLER PERINTAH (COMMANDS)
  // =======================================================
  // Bot akan merespons pesan "/start".
  bot.command("start", (ctx) => {
    ctx.reply("Halo! Bot sudah aktif dan siap digunakan.");
  });

  // 4. PENANGANAN ERROR (ERROR HANDLING)
  // =======================================================
  // Menangkap error agar bot tidak mati jika terjadi masalah.
  bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Error saat menangani update ${ctx.update.update_id}:`);
    const e = err.error;

    if (e instanceof GrammyError) {
      console.error("Error pada request Grammy:", e.description);
    } else if (e instanceof HttpError) {
      console.error("Tidak bisa terhubung ke server Telegram:", e);
    } else {
      console.error("Error tidak diketahui:", e);
    }
  });

  // 5. GRACEFUL SHUTDOWN
  // =======================================================
  // Menangani sinyal dari Deno Deploy untuk mematikan bot dengan benar.
  // Ini mencegah error "409: Conflict" saat redeploy.
  const signals = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    Deno.addSignalListener(signal, () => gracefulShutdown(signal));
  }

  async function gracefulShutdown(signal: string) {
    console.log(`Menerima sinyal: ${signal}. Mematikan bot...`);
    try {
      // Memberitahu Telegram bahwa bot akan offline.
      await bot.stop();
      console.log("Bot berhasil dihentikan.");
    } catch (e) {
      console.error("Gagal menghentikan bot:", e);
    } finally {
      // Keluar dari proses Deno.
      Deno.exit();
    }
  }

  // 6. MULAI BOT
  // =======================================================
  // Memulai bot untuk menerima pesan dari Telegram.
  try {
    console.log("Memulai bot...");
    await bot.start();
  } catch (error) {
    console.error("Gagal memulai bot:", error);
    Deno.exit(1);
  }
}

// Menjalankan fungsi utama.
main();
