require("dotenv").config();

const axios = require("axios");
const https = require("https");
const crypto = require("crypto");

const PRICES = {
 1: 90, 
 3: 200, 
 6: 450,   
 12: 700   
};

const acceptedOferta = new Set();
const userLocks = new Map();
const clientCache = new Map();

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

module.exports = {
  PRICES,
  acceptedOferta,
  userLocks,
  clientCache,
  lockUser,
  daysLeft,
  xui
};
