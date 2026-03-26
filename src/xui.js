require("dotenv").config();

const axios = require("axios");
const https = require("https");
const crypto = require("crypto");

////////////////////////////////////////////////////////////
// CONFIG
////////////////////////////////////////////////////////////

const PRICES = {
  1: 1,
  3: 200,
  6: 450,
  12: 700
};

////////////////////////////////////////////////////////////
// MEMORY
////////////////////////////////////////////////////////////

const userLocks = new Map();
const clientCache = new Map();

////////////////////////////////////////////////////////////
// LOCK (антиспам)
////////////////////////////////////////////////////////////

function lockUser(userId, ms = 500) {
  const now = Date.now();

  if (userLocks.has(userId)) {
    const last = userLocks.get(userId);

    if (now - last < ms) return true;
  }

  userLocks.set(userId, now);
  return false;
}

////////////////////////////////////////////////////////////
// AXIOS
////////////////////////////////////////////////////////////

const agent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true
});

const api = axios.create({
  baseURL: process.env.XUI_URL,
  httpsAgent: agent,
  headers: { "Content-Type": "application/json" },
  timeout: 10000
});

////////////////////////////////////////////////////////////
// UTILS
////////////////////////////////////////////////////////////

function daysLeft(expiryTime) {
  if (!expiryTime) return 0;

  const diff = expiryTime - Date.now();

  if (diff <= 0) return 0;

  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

////////////////////////////////////////////////////////////
// XUI CLASS
////////////////////////////////////////////////////////////

class XUIManager {
  constructor() {
    this.cookies = "";
    this.inbound = null;
    this.lastUpdate = 0;

    this.server = process.env.SERVER_IP;
    this.sni = process.env.SERVER_SNI;
  }

  ////////////////////////////////////////////////////////////
  // LOGIN
  ////////////////////////////////////////////////////////////

  async login() {
    try {
      const res = await api.post("login", {
        username: process.env.XUI_USER,
        password: process.env.XUI_PASS
      });

      this.cookies = res.headers["set-cookie"]?.join("; ") || "";

      api.defaults.headers.Cookie = this.cookies;

      return !!this.cookies;

    } catch (err) {
      console.error("XUI LOGIN ERROR:", err.message);
      return false;
    }
  }

  ////////////////////////////////////////////////////////////
  // GET INBOUND
  ////////////////////////////////////////////////////////////

  async getInbound() {
    try {
      if (this.inbound && Date.now() - this.lastUpdate < 10000) {
        return this.inbound;
      }

      const res = await api.get("panel/api/inbounds/list");

      const inbound = res.data?.obj?.[0];

      if (!inbound) {
        throw new Error("Inbound not found");
      }

      this.inbound = inbound;
      this.lastUpdate = Date.now();

      return inbound;

    } catch (err) {
      console.error("GET INBOUND ERROR:", err.message);
      throw err;
    }
  }

  ////////////////////////////////////////////////////////////
  // FIND CLIENT
  ////////////////////////////////////////////////////////////

  async findClient(email) {
    try {
      const cached = clientCache.get(email);

      if (cached && Date.now() - cached.time < 10000) {
        return cached.data;
      }

      const inbound = await this.getInbound();

      const clients = inbound.clientStats || [];

      const client = clients.find(c => c.email === email);

      if (client) {
        clientCache.set(email, {
          data: client,
          time: Date.now()
        });
      }

      return client || null;

    } catch (err) {
      console.error("FIND CLIENT ERROR:", err.message);
      throw err;
    }
  }

  ////////////////////////////////////////////////////////////
  // ADD USER
  ////////////////////////////////////////////////////////////

  async addUser(email, months) {
    try {
      const inbound = await this.getInbound();

      const id = crypto.randomUUID();

      const expiry = Date.now() + months * 2629800000;

      await api.post(
        "panel/api/inbounds/addClient",
        {
          id: inbound.id,
          settings: JSON.stringify({
            clients: [{
              id,
              email,
              enable: true,
              limitIp: 1,
              totalGB: 0,
              expiryTime: expiry,
              flow: "xtls-rprx-vision",
              tgId: "",
              subId: ""
            }]
          })
        }
      );

      return id;

    } catch (err) {
      console.error("ADD USER ERROR:", err.message);
      throw err;
    }
  }

  ////////////////////////////////////////////////////////////
  // EXTEND USER
  ////////////////////////////////////////////////////////////

  async extendUser(uuid, email, months) {
    try {
      const inbound = await this.getInbound();

      const clients = inbound.clientStats || [];

      const client = clients.find(c => c.email === email);

      let expiry = client?.expiryTime || Date.now();

      if (expiry < Date.now()) {
        expiry = Date.now();
      }

      expiry += months * 2629800000;

      await api.post(`panel/api/inbounds/updateClient/${uuid}`, {
        id: inbound.id,
        settings: JSON.stringify({
        clients: [{
          id: uuid,
          email,
          enable: true,              
          flow: "xtls-rprx-vision",
          limitIp: 1,
          totalGB: 0,                
          expiryTime: expiry
        }]
      })
    });

    } catch (err) {
      console.error("EXTEND USER ERROR:", err.message);
      throw err;
    }
  }

  ////////////////////////////////////////////////////////////
  // GENERATE LINK
  ////////////////////////////////////////////////////////////

  generateLink(id) {
return `vless://${id}@${this.server}?type=tcp&encryption=none&security=reality&pbk=eLh2SyMNtfcydKFDiU-YvJB9PtR8RvRtST0WZRK2g0s&fp=chrome&sni=${this.sni}&sid=151c43db95b1&spx=%2F&flow=xtls-rprx-vision#🇫🇮 Финляндия`;  }
}

////////////////////////////////////////////////////////////
// EXPORT
////////////////////////////////////////////////////////////

const xui = new XUIManager();

module.exports = {
  PRICES,
  userLocks,
  clientCache,
  lockUser,
  daysLeft,
  xui
};