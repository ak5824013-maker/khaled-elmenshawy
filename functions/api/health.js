export async function onRequestGet(context) {
  const { env } = context;
  return new Response(
    JSON.stringify({
      ok: true,
      telegramConfigured: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
  );
}
