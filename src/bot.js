require("dotenv").config();
const db = require("../data/db.js");
const { Bot, InlineKeyboard } = require("grammy");
const {
  PRICES,
  clientCache,
  lockUser,
  daysLeft,
  xui
} = require("./xui");

// MEMORY
const main_photo = 'AgACAgIAAxkBAAIFQWm0bNDa_RYMy6dmVAUUcc7xsclyAAKsG2sbdDShSXgeYHN41_B0AQADAgADeQADOgQ'
const main_menu = 'AgACAgIAAxkBAAIFRWm0bkq7QbBB1hu4eccowjFeNANKAAKyG2sbdDShSXyYsJWs5693AQADAgADeQADOgQ'
const pay_photo = 'AgACAgIAAxkBAAIFQGm0aS5JhWfPAqVHrmiFwJuKFDmPAAKWG2sbdDShSUufIe2c-0UqAQADAgADeQADOgQ'
const profil_photo = 'AgACAgIAAxkBAAIFSWm0bmIE_lN96TaDqUhdw4BafzMkAAKzG2sbdDShSeLAeGlvYKqaAQADAgADeQADOgQ'
const supp_photo = 'AgACAgIAAxkBAAIFS2m0bnCeAAFa3DG2gcILgqhju5qNqAACtBtrG3Q0oUm1KUOJznBt3QEAAwIAA3kAAzoE'
const tarid_photo = 'AgACAgIAAxkBAAIGH2m5j94SreQlsfkmoJyDYo_lNTLtAAKaG2sbacLISQWyLdDPl3iLAQADAgADeQADOgQ'


const activePayments = new Set();


async function hasUserAccepted(ctx) {
  const id = ctx.from.id;


  const email = String(id);

  try {
    const client = await xui.findClient(email);

    if (client) {
      return true;
    }

  } catch {}

  return false;
}

// BOT
const bot = new Bot(process.env.BOT_TOKEN);

// SAFE EDIT
async function safeEdit(ctx, text, keyboard = null, media = null) {
  if (!ctx.callbackQuery?.message)
    return;
  try {
    const msg = ctx.callbackQuery?.message;
    if (!msg) return;

    // анти спам кнопок
    if (lockUser(ctx.from.id))
      return;

    const options = {
      parse_mode: "HTML",
      reply_markup: keyboard || undefined
    };

    // если нужно поменять медиа
    if (media) {
      const mediaId = typeof media === "string" ? media : String(media);

      const type = msg.video ? "video" : "photo";

      return await ctx.editMessageMedia(
        {
          type: type,
          media: mediaId,
          caption: text,
          parse_mode: "HTML"
        },
        {
          reply_markup: keyboard || undefined
        }
      );
    }

    // если сообщение с фото или видео
    if (msg.photo || msg.video) {
      return await ctx.editMessageCaption({
        caption: text,
        ...options
      });
    }

    // если текст
    return await ctx.editMessageText(text, options);

  } catch (err) {
    const desc = err.description || "";

    if (
      desc.includes("message is not modified") ||
      desc.includes("message can't be edited") ||
      desc.includes("there is no text in the message to edit") ||
      desc.includes("can't parse InputMedia") ||
      desc.includes("message to edit not found")
    )
      return;

    console.error("SAFE EDIT ERROR:", err);
  }
}

// KEYBOARDS
function ofertaKeyboard() {
  return new InlineKeyboard()
    .url("📄 Оферта", "https://example.com/oferta")
    .row()
    .text("✅ Принять оферту", "accept_oferta");
}

function menuKeyboard() {
  return new InlineKeyboard()
    .text("🌐 подключится", "vpn").row()
    .text("⚙️ Управление VPN", "myvpn").row()
    .text("💬 Поддержка", "support")
}

function vpnKeyboard() {
  return new InlineKeyboard()
    .text("1 месяц", "buy_1")
    .text("3 месяца", "buy_3").row()
    .text("6 месяцев", "buy_6")
    .text("12 месяцев", "buy_12").row()
    .text("↩️ Назад", "menu");
}

function myVPNKeyboard() {
  return new InlineKeyboard()
    .text("🗝️ Показать ключ", "my_key").row()
    .text("🔄 Продлить VPN", "vpn").row()
    .text("↩️ Назад", "menu");
}

function myVPNKeyboards(){
  return new InlineKeyboard()
    .text("🔄 Продлить VPN", "vpn").row()
    .text("↩️ Назад", "menu");
}

function payKeyboard(months) {
  return new InlineKeyboard()
    .text("⭐ Оплатить STARS", `pay_stars_${months}`).row()
    .text("💳 Оплатить ЮKassa", `pay_ykassa_${months}`).row()
    .text("↩️ Назад", "vpn");
}

// START
bot.command("start", async (ctx) => {
  if (!db.hasAccepted(ctx.from.id)) {
    return ctx.replyWithPhoto(main_photo,
      {
        caption: "Перед использованием VPN необходимо принять оферту",
        reply_markup: ofertaKeyboard()
      }
    );
  }

  await ctx.replyWithPhoto(
    main_menu,
    {
      reply_markup: menuKeyboard()
    }
  );
});

// ACCEPT OFERTA
bot.callbackQuery("accept_oferta", async (ctx) => {
  db.acceptOferta(ctx.from.id);

  await ctx.answerCallbackQuery();

  await safeEdit(ctx,'',menuKeyboard(),main_menu);
});

// MENU
bot.callbackQuery("menu", async (ctx) => {
  await ctx.answerCallbackQuery();
  await safeEdit(ctx, "", menuKeyboard(),main_menu);
});

// VPN MENU
bot.callbackQuery("vpn", async (ctx) => {
  if (!db.hasAccepted(ctx.from.id))
    return ctx.answerCallbackQuery("Сначала примите оферту");
  await ctx.answerCallbackQuery();
  await safeEdit(ctx,`
    Тарифы:


1️⃣  1 месяц — 100 ₽  /  90 ⭐


3️⃣  3 месяца — 270 ₽  /  200 ⭐


6️⃣  6 месяцев — 510 ₽  /  450 ⭐


1️⃣2️⃣  12 месяцев — 900 ₽  /  700 ⭐`,
  vpnKeyboard(),tarid_photo);
});

// BUY VPN
bot.callbackQuery(/buy_(\d+)/, async (ctx) => {
  if (!db.hasAccepted(ctx.from.id))
    return ctx.answerCallbackQuery("Сначала примите оферту");

  const months = Number(ctx.match[1]);

  if (!PRICES[months])
    return ctx.answerCallbackQuery("Ошибка тарифа");

  await ctx.answerCallbackQuery();

  const pricesText = {
    1: "100 ₽ / 90 ⭐",
    3: "270 ₽ / 200 ⭐",
    6: "510 ₽ / 450 ⭐",
    12: "900 ₽ / 700 ⭐"
  };

  await safeEdit(
    ctx,
`💳 <b>Вы выбрали тариф:</b> ${months} мес.


💰 Стоимость:
${pricesText[months]}


Выберите способ оплаты 👇`,
    payKeyboard(months),
    pay_photo
  );
});

// PAY STARS
bot.callbackQuery(/pay_stars_(\d+)/, async (ctx) => {
  const months = Number(ctx.match[1]);

  if (!PRICES[months]) {
    return ctx.answerCallbackQuery("Ошибка тарифа");
  }

  if (!db.hasAccepted(ctx.from.id)) {
    return ctx.answerCallbackQuery("Сначала примите оферту");
  }

  if (activePayments.has(ctx.from.id)) {
    return ctx.answerCallbackQuery("⏳ Уже есть активная оплата");
  }

  await ctx.answerCallbackQuery();

  activePayments.add(ctx.from.id);

  setTimeout(() => {
    activePayments.delete(ctx.from.id);
  }, 5 * 60 * 1000);

  await ctx.replyWithInvoice(
    "VPN подписка",
    `VPN на ${months} мес.`,
    `vpn:${ctx.from.id}:${months}:${Date.now()}`,
    "XTR",
    [
      {
        label: `${months} мес.`,
        amount: PRICES[months]
      }
    ]
  );
});

// PAY ЮКАССА
bot.callbackQuery(/pay_ykassa_(\d+)/, async (ctx) => {
  const months = Number(ctx.match[1]);

  await ctx.answerCallbackQuery();

  await ctx.reply(
`💳 Оплата через ЮKassa


Тариф: ${months} мес.


(сюда вставишь ссылку на оплату)`
  );
});

// MY VPN
bot.callbackQuery("myvpn", async (ctx) => {
  await ctx.answerCallbackQuery();

  const email = `tg_${ctx.from.id}`;

  let client = null;

  try {
    client = await xui.findClient(email);
  } catch (err) {
    console.error("FIND CLIENT ERROR:", err);
    return ctx.reply("Ошибка сервера");
  }

  if (!client) {
    return safeEdit(
      ctx,
      "❌ У вас нет VPN",
      new InlineKeyboard().text("🌐 подключится к VPN", "vpn")
    );
  }

  const link = xui.generateLink(client.uuid);
  const days = daysLeft(client.expiryTime);

  await safeEdit(
    ctx,
    `⏳ Осталось дней: ${days}
<pre>${link}</pre>`,
    myVPNKeyboards(),
    profil_photo
  );
});

// SHOW KEY
bot.on("pre_checkout_query", (ctx) => {
  return ctx.answerPreCheckoutQuery(true);
});


bot.on("message:successful_payment", async (ctx) => {
  try {
    const db = require("../data/db");

    const payload = ctx.message.successful_payment.invoice_payload;

    const [type, userIdRaw, monthsRaw] = payload.split(":");

    db.logPayment(userId, months);
    
    if (type !== "vpn") return;

    const userId = Number(userIdRaw);
    const months = Number(monthsRaw);

    if (!PRICES[months]) {
      return ctx.reply("Ошибка тарифа");
    }

    // снимаем блок оплаты
    activePayments.delete(userId);

    const email = `tg_${userId}`;

    let client = null;

    try {
      client = await xui.findClient(email);
    } catch (err) {
      console.error("FIND CLIENT ERROR:", err);
    }

    // ЕСЛИ НОВЫЙ ПОЛЬЗОВАТЕЛЬ
    if (!client) {
      let uuid;

      try {
        uuid = await xui.addUser(email, months);
      } catch (err) {
        console.error("ADD USER ERROR:", err);
        return ctx.reply("Ошибка выдачи VPN");
      }

      const link = xui.generateLink(uuid);

      await ctx.reply(
`✅ Оплата прошла

🔐 Ваш VPN:
<pre>${link}</pre>`,
        { parse_mode: "HTML" }
      );

      return;
    }

    // ЕСЛИ ПРОДЛЕНИЕ
    try {
      await xui.extendUser(client.uuid, email, months);
    } catch (err) {
      console.error("EXTEND ERROR:", err);
      return ctx.reply("Ошибка продления VPN");
    }

    clientCache.delete(email);

    const updatedClient = await xui.findClient(email);

    const days = daysLeft(updatedClient.expiryTime);

    await ctx.reply(
`✅ VPN продлён!

⏳ Осталось дней: ${days}`,
      { parse_mode: "HTML" }
    );

  } catch (err) {
    console.error("PAYMENT ERROR:", err);
    await ctx.reply("Ошибка после оплаты");
  }
});

bot.callbackQuery("my_key", async (ctx) => {
  await ctx.answerCallbackQuery();

  const email = `tg_${ctx.from.id}`;

  let client = null;

  try {
    client = await xui.findClient(email);
  } catch (err) {
    console.error(err);
    return ctx.reply("Ошибка сервера");
  }

  if (!client)
    return ctx.reply("VPN не найден");

  const link = xui.generateLink(client.uuid);

  await safeEdit(
    ctx,
`🔑 Ваш VPN ключ
<pre>${link}</pre>

Нажмите на него чтобы скопировать.`,
    myVPNKeyboard()
  );
});

// SUPPORT
bot.callbackQuery("support", async (ctx) => {
  await ctx.answerCallbackQuery();

  await safeEdit(
  ctx,
  "Бог в помощь немощь",
  new InlineKeyboard().text("↩️ Назад", "menu"),supp_photo
  );
});

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
`⚠️ Ваш VPN скоро закончится


⏳ Осталось: ${days} дня


🔐 Ваш ключ:


\`${link}\`


Продлите VPN чтобы не потерять доступ.`,
          {
            parse_mode: "Markdown",
            reply_markup: new InlineKeyboard()
              .text("🔄 Продлить VPN", "vpn")
          }
        );
      }
    }
  }

  catch (err) {
    console.error("Check expiry error:", err);
  }
}

// START BOT
async function start() {
  const ok = await xui.login();

  if (!ok)
    throw new Error("XUI login failed");

  await xui.getInbound();

  await bot.api.setMyCommands([
    {
      command: "start",
      description: "Запустить бота"
    }
  ]);

  bot.start();

  console.log("🚀 VPN BOT STARTED");

  setInterval(checkExpiringVPN, 6 * 60 * 60 * 1000);
}

start();
