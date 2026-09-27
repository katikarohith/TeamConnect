const AppError = require('../utils/AppError');

async function requestAI(messages, maxTokens = 500) {
  if (!process.env.AI_API_KEY) throw new AppError('AI is not configured. Add AI_API_KEY to enable this optional feature.', 503);
  const response = await fetch(process.env.AI_API_BASE_URL || 'https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.AI_API_KEY}` },
    body: JSON.stringify({ model: process.env.AI_MODEL || 'gpt-4o-mini', messages, temperature: 0.3, max_tokens: maxTokens })
  });
  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    console.error('AI provider error:', response.status, details.error?.message || 'Unknown error');
    throw new AppError('The AI assistant is temporarily unavailable. Please try again later.', 503);
  }
  const body = await response.json();
  const content = body.choices?.[0]?.message?.content?.trim();
  if (!content) throw new AppError('The AI service returned an empty response. Please try again.', 503);
  return content;
}

async function generateTaskBreakdown(description) {
  const content = await requestAI([
    { role: 'system', content: 'You are a practical engineering planning assistant. Return only a concise JSON array of 3 to 8 actionable task strings. Do not include markdown.' },
    { role: 'user', content: `Break this project task into clear implementation subtasks:\n${description}` }
  ], 400);
  try {
    const parsed = JSON.parse(content.replace(/^```json\s*|\s*```$/g, ''));
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) return parsed.slice(0, 8);
  } catch (error) { /* Use readable line fallback below for providers that do not follow JSON perfectly. */ }
  const fallback = content.split('\n').map((line) => line.replace(/^\s*(?:\d+[.)]|[-*])\s*/, '').trim()).filter(Boolean).slice(0, 8);
  if (!fallback.length) throw new AppError('The AI response could not be understood. Please try again.', 503);
  return fallback;
}

async function summarizeConversation(messages) {
  const transcript = messages.map((message) => `${message.sender?.name || 'Member'}: ${message.content || '[image]'}`).join('\n');
  return requestAI([
    { role: 'system', content: 'Summarize the following team discussion in a concise, neutral format. Include decisions, blockers, and next actions when present. Do not invent facts.' },
    { role: 'user', content: transcript }
  ], 500);
}

module.exports = { generateTaskBreakdown, summarizeConversation };
