require("dotenv").config();

const { Bot, InlineKeyboard} = require("grammy");
const axios = require("axios");
const https = require("https");
const crypto = require("crypto");
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
  1: 10000,   // 100 ⭐
  3: 27000,   // 270 ⭐
  6: 51000,   // 510 ⭐
  12: 90000   // 900 ⭐ (добавил)
};

const acceptedOferta = new Set();
const userLocks = new Map();
const clientCache = new Map();


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

    if (now - last < ms)
      return true;

  }
  userLocks.set(userId, now);

  return false;

}

////////////////////////////////////////////////////////////
// XUI API
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
const agent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true
});

const api = axios.create({
  baseURL: process.env.XUI_URL,
  httpsAgent: agent,
  headers: { "Content-Type": "application/json" }
});

function daysLeft(expiryTime) {

  if (!expiryTime) return 0;

  const diff = expiryTime - Date.now();

  if (diff <= 0) return 0;

  return Math.ceil(diff / (1000 * 60 * 60 * 24));

}

class XUIManager {

  constructor() {
    this.cookies = "";
    this.inbound = null;
    this.lastUpdate = 0;

    this.server = process.env.SERVER_IP;
    this.sni = process.env.SERVER_SNI;
  }

  async login() {

    const res = await api.post("login", {
      username: process.env.XUI_USER,
      password: process.env.XUI_PASS
    });

    this.cookies = res.headers["set-cookie"]?.join("; ") || "";

    api.defaults.headers.Cookie = this.cookies;

    return !!this.cookies;
  }

  async getInbound() {

    if (this.inbound && Date.now() - this.lastUpdate < 10000)
      return this.inbound;

    const res = await api.get("panel/api/inbounds/list");

    this.inbound = res.data.obj?.[0];

    if (!this.inbound)
      throw new Error("Inbound not found");

    this.lastUpdate = Date.now();

    return this.inbound;
  }

  async findClient(email) {

  if (clientCache.has(email))
    return clientCache.get(email);
  const inbound = await this.getInbound();
  const client = inbound.clientStats.find(c => c.email === email);
  if (client)
    clientCache.set(email, client);

  return client || null;
  }

  async addUser(email, months) {

  const inbound = await this.getInbound();

  const id = crypto.randomUUID();

  const expiry = Date.now() + months * 2629800000;

  await api.post(
      "panel/api/inbounds/addClient",
      {
        id: this.inbound.id,
        settings: JSON.stringify({ 
          clients: [{ 
            id: id, 
            email: email, 
            enable: true, 
            limitIp: 1, 
            totalGB: 0, 
            expiryTime: expiry, 
            flow: "xtls-rprx-vision", 
            tgId: "", 
            subId: "",
          }] 
        })
      }
    );

  return id;
}

  async extendUser(uuid, email, months) {

    const inbound = await this.getInbound();

    const client = inbound.clientStats.find(c => c.email === email);

    let expiry = client?.expiryTime || Date.now();

    if (expiry < Date.now())
      expiry = Date.now();

    expiry += months * 2629800000;

    await api.post(`panel/api/inbounds/updateClient/${uuid}`, {
      id: inbound.id,
      settings: JSON.stringify({
        clients: [{
          id: uuid,
          email,
          flow: "xtls-rprx-vision",
          limitIp: 1,
          expiryTime: expiry
        }]
      })
    });

  }

  generateLink(id) {
  return `vless://${id}@89.125.53.148:443?type=tcp&encryption=none&security=reality&pbk=nNsVyT-sVn3qrfTk9ecJ5KTcoB24NUr7c2MLaeHnKnc&fp=chrome&sni=web.max.ru&sid=b60b&spx=%2F&flow=xtls-rprx-vision#🇫🇮Финляндия`;
  }
}
const xui = new XUIManager();
////////////////////////////////////////////////////////////
// BOT
////////////////////////////////////////////////////////////
const bot = new Bot(process.env.BOT_TOKEN);
////////////////////////////////////////////////////////////
// SAFE EDIT
////////////////////////////////////////////////////////////
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

  }

  catch (err) {

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

////////////////////////////////////////////////////////////
// KEYBOARDS
////////////////////////////////////////////////////////////

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
////////////////////////////////////////////////////////////
// START
////////////////////////////////////////////////////////////


bot.command("start", async (ctx) => {

  if (!(await hasUserAccepted(ctx))) {

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



////////////////////////////////////////////////////////////
// ACCEPT OFERTA
////////////////////////////////////////////////////////////

bot.callbackQuery("accept_oferta", async (ctx) => {

  acceptedOferta.add(ctx.from.id);

  await ctx.answerCallbackQuery();

  await safeEdit(ctx,'',menuKeyboard(),main_menu);
});

////////////////////////////////////////////////////////////
// MENU
////////////////////////////////////////////////////////////

bot.callbackQuery("menu", async (ctx) => {

  await ctx.answerCallbackQuery();
  await safeEdit(ctx, "", menuKeyboard());

});

////////////////////////////////////////////////////////////
// VPN MENU
////////////////////////////////////////////////////////////

bot.callbackQuery("vpn", async (ctx) => {
  if (!(await hasUserAccepted(ctx)))
    return ctx.answerCallbackQuery("Сначала примите оферту");
  await ctx.answerCallbackQuery();
  await safeEdit(ctx,`
1️⃣ 1 месяц — 100 ₽

3️⃣ 3 месяца — 270 ₽

6️⃣ 6 месяцев — 510 ₽`,
vpnKeyboard(),pay_photo);
});

////////////////////////////////////////////////////////////
// BUY VPN
////////////////////////////////////////////////////////////

bot.callbackQuery(/buy_(\d+)/, async (ctx) => {

  if (!(await hasUserAccepted(ctx)))
    return ctx.answerCallbackQuery("Сначала примите оферту");

  const months = Number(ctx.match[1]);

  if (!PRICES[months])
    return ctx.answerCallbackQuery("Ошибка тарифа");

  await ctx.answerCallbackQuery();

  await ctx.api.sendInvoice(ctx.from.id, {
    title: "VPN подписка",
    description: `VPN на ${months} мес.`,
    payload: `vpn_${months}_${ctx.from.id}`,
    provider_token: "",
    currency: "XTR",
    prices: [
      {
        label: `${months} мес.`,
        amount: PRICES[months]
      }
    ]
  });

});

////////////////////////////////////////////////////////////
// MY VPN
////////////////////////////////////////////////////////////

bot.callbackQuery("myvpn", async (ctx) => {

  await ctx.answerCallbackQuery();

  const email = String(ctx.from.id);

  const client = await xui.findClient(email);

  if (!client) {

    return safeEdit(
      ctx,
      "❌ У вас нет VPN",
      new InlineKeyboard().text("🔐 Купить VPN", "vpn")
    );

  }

  const link = xui.generateLink(client.uuid);

  const days = daysLeft(client.expiryTime);

  await safeEdit(ctx,`⏳ Осталось дней: ${days}
  <pre>${link}</pre>`,
  myVPNKeyboards(),profil_photo);

});

////////////////////////////////////////////////////////////
// SHOW KEY
////////////////////////////////////////////////////////////

bot.on("pre_checkout_query", (ctx) => {
  return ctx.answerPreCheckoutQuery(true);
});

bot.on("message:successful_payment", async (ctx) => {

  try {

    const payload = ctx.message.successful_payment.invoice_payload;

    const parts = payload.split("_");

    const months = Number(parts[1]);
    const userId = parts[2];

    const email = String(userId);

    const client = await xui.findClient(email);

    if (!client) {

      const uuid = await xui.addUser(email, months);
      const link = xui.generateLink(uuid);

      await ctx.reply(
`✅ Оплата прошла

🔐 Ваш VPN:
<pre>${link}</pre>`,
        { parse_mode: "HTML" }
      );

      return;

    }

    await xui.extendUser(client.uuid, email, months);

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

  const email = String(ctx.from.id);

  const client = await xui.findClient(email);

  if (!client)
    return ctx.reply("VPN не найден");

  const link = xui.generateLink(client.uuid);

  await safeEdit(ctx,
  `🔑 Ваш VPN ключ
  <pre>${link}</pre>

Нажмите на него чтобы скопировать.`,
    myVPNKeyboard(),
    { parse_mode: "HTML" }
  );

});

////////////////////////////////////////////////////////////
// SUPPORT
////////////////////////////////////////////////////////////

bot.callbackQuery("support", async (ctx) => {

  await ctx.answerCallbackQuery();

  await safeEdit(
  ctx,
  "Бог в помощь немощь",
  new InlineKeyboard().text("🔙 Назад", "menu"),supp_photo
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

////////////////////////////////////////////////////////////
// START BOT
////////////////////////////////////////////////////////////

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