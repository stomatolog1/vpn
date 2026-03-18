const { Bot } = require("grammy");

const bot = new Bot("8443833896:AAHpLGw7XOoDhXgVFANp1vvznuf_BOE0OEk");

// /start
bot.command('start', (ctx) => {
    const keyboard = new InlineKeyboard()
        .text('Купить за 5 ⭐', 'buy_5')
        .text('Купить за 10 ⭐', 'buy_10');

    ctx.reply('Выбери покупку:', { reply_markup: keyboard });
});

// обработка нажатий
bot.callbackQuery('buy_5', async (ctx) => {
    await ctx.answerCallbackQuery();

    await ctx.replyWithInvoice({
        title: 'Доступ (5 ⭐)',
        description: 'Ссылка basic',
        payload: 'stars_5',
        currency: 'XTR', // Telegram Stars
        prices: [{ label: '5 Stars', amount: 5 }]
    });
});

bot.callbackQuery('buy_10', async (ctx) => {
    await ctx.answerCallbackQuery();

    await ctx.replyWithInvoice({
        title: 'Доступ (10 ⭐)',
        description: 'Ссылка premium',
        payload: 'stars_10',
        currency: 'XTR',
        prices: [{ label: '10 Stars', amount: 10 }]
    });
});

// обязательно: подтверждение оплаты
bot.on('pre_checkout_query', (ctx) => {
    ctx.answerPreCheckoutQuery(true);
});

// после успешной оплаты
bot.on('message:successful_payment', (ctx) => {
    const payload = ctx.message.successful_payment.invoice_payload;

    if (payload === 'stars_10') {
        ctx.reply('✅ Оплата прошла!\nСсылка: https://example.com/premium');
    } else if (payload === 'stars_5') {
        ctx.reply('✅ Оплата прошла!\nСсылка: https://example.com/basic');
    }
});

bot.start();