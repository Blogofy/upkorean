// AI Tutor — Claude via the official Anthropic SDK. The API key stays on the server (ANTHROPIC_API_KEY).
import Anthropic from "@anthropic-ai/sdk";

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
export const tutorEnabled = () => !!client;

const MODEL = process.env.TUTOR_MODEL || "claude-opus-5";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply_ko", "reply_uz", "correction", "used_words", "tip"],
  properties: {
    reply_ko: { type: "string", description: "Tutor's reply in Korean (1–3 short sentences)." },
    reply_uz: { type: "string", description: "Uzbek (Latin script) translation of reply_ko." },
    correction: {
      type: "object",
      additionalProperties: false,
      required: ["has_error", "wrong", "right", "explanation"],
      properties: {
        has_error: { type: "boolean", description: "True if the learner's last message contains a mistake." },
        wrong: { type: "string", description: "The incorrect fragment exactly as the learner wrote it, or empty." },
        right: { type: "string", description: "The corrected fragment, or empty." },
        explanation: { type: "string", description: "Short explanation in Uzbek (Latin script), or empty." },
      },
    },
    used_words: {
      type: "array",
      description: "Target vocabulary words the learner used in their last message.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["word", "correct"],
        properties: { word: { type: "string" }, correct: { type: "boolean" } },
      },
    },
    tip: { type: "string", description: "One short study recommendation in Uzbek, or empty." },
  },
};

const MODES = {
  talk: "Free conversation (대화). Chat naturally about everyday topics and steer the learner toward using the target words. Ask one follow-up question per turn.",
  fix: "Sentence correction (교정). Ask the learner to write a sentence using one target word; correct grammar and word choice carefully, then give the next target word.",
  weak: "Weak-word drill (약점). The target words are the learner's weak words. Practice them one at a time: ask the learner to use the word in a sentence or answer a question that needs it.",
  quiz: "Quiz (시험). Ask one short quiz question per turn about a target word (meaning, fill-in-the-blank, or usage), then grade the learner's answer in the next turn.",
};

const LEVELS = { beg: "beginner (TOPIK I)", mid: "intermediate (TOPIK II, levels 3–4)", adv: "advanced (TOPIK 5–6)" };

function systemPrompt({ mode, level, name, words }) {
  const list = words.map((w) => `${w.ko} — ${w.uz}`).join("\n");
  return `You are 선생님, a warm, concise Korean tutor on UpKorean, a Korean vocabulary course for Uzbek speakers built on the official NIKL graded word list (TOPIK levels 1–6).
The learner is ${name || "a student"}, level: ${LEVELS[level] || LEVELS.mid}.

Session type: ${MODES[mode] || MODES.talk}

Target vocabulary for this session (Korean — Uzbek):
${list || "(any everyday vocabulary at the learner's level)"}

How to reply:
- reply_ko: natural Korean at the learner's level, 1–3 short sentences, polite 해요체. Prefer the target words.
- reply_uz: faithful Uzbek (Latin script) translation of reply_ko.
- correction: check only the learner's latest message. If it has a grammar, spelling, particle or word-choice mistake, set has_error=true, quote the smallest wrong fragment exactly as written in "wrong", give the fix in "right", and explain the rule briefly in Uzbek. Otherwise has_error=false and empty strings.
- used_words: list target words (dictionary form, exactly as in the list) the learner used in their latest message, with correct=false if misused.
- tip: at most one short Uzbek recommendation when useful (for example a grammar point to practice), otherwise empty.
- If the learner writes in Uzbek or asks for help, answer the question and gently continue in Korean.`;
}

const clip = (s, n) => String(s || "").slice(0, n);

export async function tutorReply(body, user) {
  if (!client) return { status: 503, json: { error: "AI tutor serverda sozlanmagan", offline: true } };

  const words = (Array.isArray(body.words) ? body.words : []).slice(0, 80)
    .map((w) => ({ ko: clip(w.ko, 40), uz: clip(w.uz, 80) })).filter((w) => w.ko);
  const history = (Array.isArray(body.history) ? body.history : []).slice(-30)
    .map((m) => ({ role: m.role === "tutor" ? "assistant" : "user", content: clip(m.text, 1200) }))
    .filter((m) => m.content.trim());

  // The conversation must start with a user turn; the opening instruction is not shown to the learner.
  const messages = [{ role: "user", content: "[Start the session: greet the learner briefly and give the first prompt.]" }];
  for (const m of history) {
    const last = messages[messages.length - 1];
    if (last.role === m.role) last.content += "\n" + m.content; else messages.push(m);
  }
  if (messages[messages.length - 1].role !== "user") {
    return { status: 400, json: { error: "Oxirgi xabar foydalanuvchidan bo'lishi kerak" } };
  }

  try {
    const resp = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: systemPrompt({ mode: body.mode, level: body.level, name: clip(user.name, 60), words }),
      messages,
    });
    if (resp.stop_reason === "refusal") {
      return { status: 200, json: { refused: true, reply_ko: "", reply_uz: "Kechirasiz, bu so'rovga javob bera olmayman. Boshqa mavzuda davom etamizmi?" } };
    }
    if (resp.stop_reason === "max_tokens") {
      return { status: 502, json: { error: "Javob juda uzun bo'lib ketdi, qayta urinib ko'ring" } };
    }
    const text = resp.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    return { status: 200, json: JSON.parse(text) };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return { status: 503, json: { error: "Server API kaliti noto'g'ri", offline: true } };
    if (err instanceof Anthropic.RateLimitError) return { status: 429, json: { error: "AI tutor band. Birozdan keyin urinib ko'ring." } };
    if (err instanceof Anthropic.APIConnectionError) return { status: 502, json: { error: "AI xizmatiga ulanib bo'lmadi" } };
    if (err instanceof Anthropic.APIError) { console.error("tutor api error", err.status, err.message); return { status: 502, json: { error: "AI xizmatida xatolik" } }; }
    if (err instanceof SyntaxError) return { status: 502, json: { error: "AI javobini o'qib bo'lmadi" } };
    throw err;
  }
}
