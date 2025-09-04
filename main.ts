import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { Bot } from "https://deno.land/x/grammy@v1.25.1/mod.ts";

// Ambil token dari environment variables yang sudah di-load dari file .env
const BOT_TOKEN = Deno.env.get("BOT_TOKEN") || "";

if (!BOT_TOKEN) {
  console.error("Error: BOT_TOKEN tidak ditemukan di file .env");
  Deno.exit(1);
}

// Buat instance bot menggunakan token dari .env
const bot = new Bot(BOT_TOKEN);

// (Tambahkan sisa kode bot Anda di sini)
// bot.command("start", (ctx) => ctx.reply("Welcome!"));
// bot.start();

console.log("Bot sedang berjalan...");