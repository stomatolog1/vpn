const { Bot } = require("grammy");

const bot = new Bot("Token");

bot.on("message:photo", (ctx) => {
    const photo = ctx.message.photo;
    const fileId = photo[photo.length - 1].file_id;

    console.log("FILE_ID:", fileId);
});

bot.start();