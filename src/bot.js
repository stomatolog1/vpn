require("dotenv").config();

const { Bot, InlineKeyboard } = require("grammy");
const { xui, daysLeft, clientCache } = require("./xui");

////////////////////////////////////////////////////////////
// MEMORY
////////////////////////////////////////////////////////////
const main_photo = 'AgACAgIAAxkBAAIFQWm0bNDa_RYMy6dmVAUUcc7xsclyAAKsG2sbdDShSXgeYHN41_B0AQADAgADeQADOgQ'
const main_menu = 'AgACAgIAAxkBAAIFRWm0bkq7QbBB1hu4eccowjFeNANKAAKyG2sbdDShSXyYsJWs5693AQADAgADeQADOgQ'
const pay_photo = 'AgACAgIAAxkBAAIFQGm0aS5JhWfPAqVHrmiFwJuKFDmPAAKWG2sbdDShSUufIe2c-0UqAQADAgADeQADOgQ'
const profil_photo = 'AgACAgIAAxkBAAIFSWm0bmIE_lN96TaDqUhdw4BafzMkAAKzG2sbdDShSeLAeGlvYKqaAQADAgADeQADOgQ'
const supp_photo = 'AgACAgIAAxkBAAIFS2m0bnCeAAFa3DG2gcILgqhju5qNqAACtBtrG3Q0oUm1KUOJznBt3QEAAwIAA3kAAzoE'
const tarid_photo = 'AgACAgIAAxkBAAIGH2m5j94SreQlsfkmoJyDYo_lNTLtAAKaG2sbacLISQWyLdDPl3iLAQADAgADeQADOgQ'

const PRICES = {
  1: 90,
  3: 200,
  6: 450,
  12: 700
};

const acceptedOferta = new Set();
const userLocks = new Map();

////////////////////////////////////////////////////////////
// BOT
////////////////////////////////////////////////////////////
const bot = new Bot(process.env.BOT_TOKEN);

////////////////////////////////////////////////////////////
// HELPERS
////////////////////////////////////////////////////////////
async function hasUserAccepted(ctx) {
  const id = ctx.from.id;

  if (acceptedOferta.has(id))
    return true;

  const email = String(id);

  try {
    const client = await xui.findClient(email);

    if (client) {
      acceptedOferta.add(id);
      return true;
    }
  } catch {}

  return false;
}

function lockUser(userId, ms = 1500) {
  const now = Date.now();

  if (userLocks.has(userId)) {
    const last = userLocks.get(userId);
    if (now - last < ms) return true;
  }

  userLocks.set(userId, now);
  return false;
}

////////////////////////////////////////////////////////////
// SAFE EDIT
////////////////////////////////////////////////////////////
async function safeEdit(ctx, text, keyboard = null, media = null) {
  if (!ctx.callbackQuery?.message) return;

  try {
    const msg = ctx.callbackQuery.message;

    if (lockUser(ctx.from.id)) return;

    const options = {
      parse_mode: "HTML",
      reply_markup: keyboard || undefined
    };

    if (media) {
      const type = msg.video ? "video" : "photo";

      return await ctx.editMessageMedia(
        {
          type,
          media,
          caption: text,
          parse_mode: "HTML"
        },
        { reply_markup: keyboard || undefined }
      );
    }

    if (msg.photo || msg.video) {
      return await ctx.editMessageCaption({
        caption: text,
        ...options
      });
    }

    return await ctx.editMessageText(text, options);

  } catch (err) {
    const desc = err.description || "";

    if (
      desc.includes("message is not modified") ||
      desc.includes("message can't be edited")
    ) return;

    console.error("SAFE EDIT ERROR:", err);
  }
}

////////////////////////////////////////////////////////////
// KEYBOARDS
////////////////////////////////////////////////////////////
const ofertaKeyboard = () =>
  new InlineKeyboard()
    .url("📄 Оферта", "https://example.com/oferta")
    .row()
    .text("✅ Принять оферту", "accept_oferta");

const menuKeyboard = () =>
  new InlineKeyboard()
    .text("🌐 подключится", "vpn").row()
    .text("⚙️ Управление VPN", "myvpn").row()
    .text("💬 Поддержка", "support");

const vpnKeyboard = () =>
  new InlineKeyboard()
    .text("1 месяц", "buy_1")
    .text("3 месяца", "buy_3").row()
    .text("6 месяцев", "buy_6")
    .text("12 месяцев", "buy_12").row()
    .text("↩️ Назад", "menu");

const myVPNKeyboard = () =>
  new InlineKeyboard()
    .text("🗝️ Показать ключ", "my_key").row()
    .text("🔄 Продлить VPN", "vpn").row()
    .text("↩️ Назад", "menu");

const payKeyboard = (months) =>
  new InlineKeyboard()
    .text("⭐ Оплатить STARS", `pay_stars_${months}`).row()
    .text("💳 ЮKassa", `pay_ykassa_${months}`).row()
    .text("↩️ Назад", "vpn");

////////////////////////////////////////////////////////////
// CHECK EXPIRY
////////////////////////////////////////////////////////////
async function checkExpiringVPN() {
  try {
    const inbound = await xui.getInbound();
    const clients = inbound.clientStats || [];

    for (const client of clients) {
      if (!client.email) continue;

      const days = daysLeft(client.expiryTime);

      if (days === 3) {
        const link = xui.generateLink(client.uuid);

        await bot.api.sendMessage(
          client.email,
`⚠️ VPN скоро закончится

⏳ Осталось: ${days} дня

\`${link}\``,
          {
            parse_mode: "Markdown",
            reply_markup: new InlineKeyboard()
              .text("🔄 Продлить", "vpn")
          }
        );
      }
    }
  } catch (err) {
    console.error(err);
  }
}

////////////////////////////////////////////////////////////
// START
////////////////////////////////////////////////////////////
bot.command("start", async (ctx) => {

  if (!(await hasUserAccepted(ctx))) {
    return ctx.replyWithPhoto(main_photo, {
      caption: "Примите оферту",
      reply_markup: ofertaKeyboard()
    });
  }

  await ctx.replyWithPhoto(main_menu, {
    reply_markup: menuKeyboard()
  });
});

////////////////////////////////////////////////////////////
// CALLBACKS
////////////////////////////////////////////////////////////
bot.callbackQuery("accept_oferta", async (ctx) => {
  acceptedOferta.add(ctx.from.id);
  await ctx.answerCallbackQuery();
  await safeEdit(ctx, "", menuKeyboard(), main_menu);
});

bot.callbackQuery("menu", async (ctx) => {
  await ctx.answerCallbackQuery();
  await safeEdit(ctx, "", menuKeyboard(), main_menu);
});

bot.callbackQuery("vpn", async (ctx) => {
  if (!(await hasUserAccepted(ctx)))
    return ctx.answerCallbackQuery("Прими оферту");

  await ctx.answerCallbackQuery();

  await safeEdit(ctx, "Выбери тариф", vpnKeyboard(), tarid_photo);
});

////////////////////////////////////////////////////////////
// PAY
////////////////////////////////////////////////////////////
bot.callbackQuery(/buy_(\d+)/, async (ctx) => {
  const months = Number(ctx.match[1]);
  await ctx.answerCallbackQuery();

  await safeEdit(
    ctx,
    `Тариф: ${months} мес.`,
    payKeyboard(months),
    pay_photo
  );
});

bot.callbackQuery(/pay_stars_(\d+)/, async (ctx) => {
  const months = Number(ctx.match[1]);

  await ctx.answerCallbackQuery();

  await ctx.replyWithInvoice(
    "VPN",
    `VPN ${months} мес`,
    `vpn_${months}_${ctx.from.id}`,
    "XTR",
    [{ label: "VPN", amount: PRICES[months] }]
  );
});

bot.on("pre_checkout_query", (ctx) => ctx.answerPreCheckoutQuery(true));

bot.on("message:successful_payment", async (ctx) => {
  const payload = ctx.message.successful_payment.invoice_payload;
  const [_, months, userId] = payload.split("_");

  const email = String(userId);

  const client = await xui.findClient(email);

  if (!client) {
    const uuid = await xui.addUser(email, months);
    return ctx.reply(`<pre>${xui.generateLink(uuid)}</pre>`, { parse_mode: "HTML" });
  }

  await xui.extendUser(client.uuid, email, months);
  clientCache.delete(email);

  const updated = await xui.findClient(email);

  await ctx.reply(`Осталось дней: ${daysLeft(updated.expiryTime)}`);
});

////////////////////////////////////////////////////////////
// START BOT
////////////////////////////////////////////////////////////
async function start() {
  const ok = await xui.login();

  if (!ok) throw new Error("XUI login failed");

  await xui.getInbound();

  bot.start();

  console.log("🚀 BOT STARTED");

  setInterval(checkExpiringVPN, 6 * 60 * 60 * 1000);
}

start();