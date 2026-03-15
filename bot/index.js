// Sahara Smart Assistant - Telegram Bot
// npm install grammy
const { Bot } = require('grammy');
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL || 'mistral';

if (!BOT_TOKEN) { console.error('❌ TELEGRAM_BOT_TOKEN not set!'); process.exit(1); }

const SYSTEM_PROMPT = 'أنت مساعد Sahara الذكي، متخصص في البرمجة وهندسة الشبكات وإدارة الأنظمة. أجب بالعربية.';
const conversations = new Map();

function getConv(uid) { if (!conversations.has(uid)) conversations.set(uid, []); return conversations.get(uid); }
function addConv(uid, role, content) { const c = getConv(uid); c.push({ role, content }); if (c.length > 20) conversations.set(uid, c.slice(-20)); }

async function askOllama(prompt, userId) {
  const history = getConv(userId).slice(-6).map(m => `${m.role === 'user' ? 'المستخدم' : 'المساعد'}: ${m.content}`).join('\n');
  let sys = SYSTEM_PROMPT; if (history) sys += `\n\nسجل المحادثة:\n${history}`;
  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: MODEL, prompt, system: sys, stream: false, options: { temperature: 0.7 } }) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()).response || 'لم أتمكن من الإجابة.';
  } catch (e) { return e.message.includes('fetch') ? '❌ أوليما غير متصلة. شغّل: ollama serve' : `❌ ${e.message}`; }
}

const bot = new Bot(BOT_TOKEN);
bot.command('start', ctx => ctx.reply('🏜️ مرحباً! أنا مساعد Sahara الذكي.\nاكتب سؤالك وسأجيبك.\n\n/help - المساعدة\n/clear - مسح المحادثة\n/status - حالة النظام'));
bot.command('help', ctx => ctx.reply('🏜️ الأوامر:\n/start - بدء\n/clear - مسح المحادثة\n/status - حالة النظام'));
bot.command('clear', ctx => { conversations.delete(ctx.from.id); ctx.reply('🗑️ تم مسح المحادثة'); });
bot.command('status', async ctx => { let s = '❌ غير متصلة'; try { const r = await fetch(`${OLLAMA_URL}/api/tags`); if (r.ok) { const d = await r.json(); s = `✅ متصلة (${d.models?.length || 0} نموذج)`; } } catch(_){} ctx.reply(`📊 Ollama: ${s}\n🧠 النموذج: ${MODEL}`); });
bot.on('message:text', async ctx => { await ctx.replyWithChatAction('typing'); addConv(ctx.from.id, 'user', ctx.message.text); const reply = await askOllama(ctx.message.text, ctx.from.id); addConv(ctx.from.id, 'assistant', reply); if (reply.length > 4000) { for (const p of reply.match(/.{1,4000}/gs)) await ctx.reply(p); } else await ctx.reply(reply); });
bot.start({ onStart: () => console.log(`🏜️ Sahara Bot running! Model: ${MODEL}`) });
process.on('SIGINT', () => { bot.stop(); process.exit(0); });
