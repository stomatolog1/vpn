const fs = require("fs");
const path = require("path");

////////////////////////////////////////////////////////////
// CONFIG
////////////////////////////////////////////////////////////

const DB_FILE = path.join(__dirname, "db.json");

////////////////////////////////////////////////////////////
// CACHE (чтобы не читать файл каждый раз)
////////////////////////////////////////////////////////////

let cache = null;

////////////////////////////////////////////////////////////
// LOAD
////////////////////////////////////////////////////////////

function loadDB() {
  if (cache) return cache;

  try {
    if (!fs.existsSync(DB_FILE)) {
      cache = { users: {}, payments: [] };
      saveDB(cache);
      return cache;
    }

    const data = fs.readFileSync(DB_FILE, "utf-8");

    cache = JSON.parse(data);

    // защита
    if (!cache.users) cache.users = {};
    if (!cache.payments) cache.payments = [];

    return cache;

  } catch (err) {
    console.error("DB LOAD ERROR:", err);

    cache = { users: {}, payments: [] };
    return cache;
  }
}

////////////////////////////////////////////////////////////
// SAVE
////////////////////////////////////////////////////////////

function saveDB(db) {
  try {
    cache = db;

    // атомарная запись
    const tempFile = DB_FILE + ".tmp";

    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2));
    fs.renameSync(tempFile, DB_FILE);

  } catch (err) {
    console.error("DB SAVE ERROR:", err);
  }
}

////////////////////////////////////////////////////////////
// USERS
////////////////////////////////////////////////////////////

function acceptOferta(userId) {
  const db = loadDB();

  if (!db.users[userId]) {
    db.users[userId] = {};
  }

  db.users[userId].accepted = true;
  db.users[userId].acceptedAt = new Date().toISOString();

  saveDB(db);
}

function hasAccepted(userId) {
  const db = loadDB();

  return db.users[userId]?.accepted || false;
}

////////////////////////////////////////////////////////////
// PAYMENTS
////////////////////////////////////////////////////////////

function logPayment(userId, months) {
  const db = loadDB();

  db.payments.push({
    userId,
    months,
    date: new Date().toISOString()
  });

  saveDB(db);
}

////////////////////////////////////////////////////////////
// EXPORT
////////////////////////////////////////////////////////////

module.exports = {
  acceptOferta,
  hasAccepted,
  logPayment
};