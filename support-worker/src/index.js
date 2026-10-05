// ============================================================================
// Outstations Support — backend del chatbot de soporte (Cloudflare Workers AI)
//
// Recibe la conversacion del HTML del chatbot, la pasa por Workers AI con la base
// de conocimiento (knowledge-base.js) como prompt de sistema y devuelve la respuesta.
//
// Proteccion de la cuota diaria de Workers AI (10.000 "neurons"/dia, compartida en la cuenta):
//  - CORS solo deja usarlo desde ALLOWED_ORIGIN, pero eso solo frena a los navegadores;
//  - por eso ademas se rechaza cualquier Origin distinto (403) y se limita el numero de
//    peticiones por IP y en total con los bindings de Rate Limiting (ver wrangler.toml).
// Desplegar: cd support-worker && npx wrangler deploy
// ============================================================================
import { KNOWLEDGE_BASE } from './knowledge-base.js';

const ALLOWED_ORIGIN = 'https://victorjorge5.github.io';
const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Vary': 'Origin',
};

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extra },
  });
}

// true si se puede atender; si el binding no esta configurado no se limita (no rompe el despliegue actual)
async function underLimit(limiter, key) {
  if (!limiter) return true;
  const { success } = await limiter.limit({ key });
  return success;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    // un navegador en otra web siempre manda Origin: se corta antes de gastar nada
    const origin = request.headers.get('Origin');
    if (origin && origin !== ALLOWED_ORIGIN) {
      return json({ error: 'Origin not allowed' }, 403);
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!(await underLimit(env.PER_IP_LIMITER, ip)) || !(await underLimit(env.GLOBAL_LIMITER, 'global'))) {
      return json({ error: 'Too many requests. Please wait a minute and try again.' }, 429, { 'Retry-After': '60' });
    }

    let history;
    try {
      const body = await request.json();
      if (!Array.isArray(body.messages) || body.messages.length === 0) throw new Error('empty messages');
      // Basic validation and guards: only role/content pairs, capped length and size.
      history = body.messages
        .slice(-20) // keep only the last 20 turns
        .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }));
      if (history.length === 0) throw new Error('no valid messages');
    } catch {
      return json({ error: 'Invalid request body' }, 400);
    }

    try {
      const aiResponse = await env.AI.run(MODEL, {
        messages: [
          { role: 'system', content: KNOWLEDGE_BASE },
          ...history,
        ],
        max_tokens: 220,
      });

      const text = aiResponse && aiResponse.response;
      if (!text) return json({ error: 'Empty response' }, 502);
      return json({ answer: text });
    } catch (e) {
      // el detalle solo va a los registros del Worker, no al navegador
      console.error('Workers AI error:', e && e.stack ? e.stack : e);
      return json({ error: 'Workers AI request failed' }, 500);
    }
  },
};
