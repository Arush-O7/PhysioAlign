import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config.js';
import type { FrameLog, SessionRow, UserRow } from '../lib/types.js';
import { toSession } from '../lib/mappers.js';

const PRIMARY_MODEL = 'gemini-2.5-flash';
const LITE_MODEL = 'gemini-2.5-flash-lite';

const genAI = config.geminiApiKey ? new GoogleGenerativeAI(config.geminiApiKey) : null;
export const geminiEnabled = !!genAI;

type Profile = Pick<UserRow, 'name' | 'age' | 'experience' | 'goal'>;

const traineeProfile = (user: Profile) => `
Trainee Profile:
- Name: ${user.name}
- Age: ${user.age}
- Yoga Experience: ${user.experience}
- Goal: ${user.goal}`;

// tries the main model, then the lite one. throws if both fail so the caller can decide what to do
async function generate(systemInstruction: string, prompt: string): Promise<string> {
  if (!genAI) throw new Error('Gemini is not configured');
  let lastError: unknown;
  for (const modelId of [PRIMARY_MODEL, LITE_MODEL]) {
    try {
      const model = genAI.getGenerativeModel({ model: modelId, systemInstruction });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      lastError = error;
      console.warn(`[gemini] ${modelId} failed:`, (error as Error).message);
    }
  }
  throw lastError;
}

export function placeholderCritique(session: Pick<SessionRow, 'pose_name' | 'average_score' | 'grade' | 'hold_time_seconds'>) {
  return `
### 1. Biomechanical Analysis
Your practice of **${session.pose_name}** was analyzed with an overall accuracy of **${session.average_score}%**, earning a Grade **${session.grade}**.
- **Strengths**: Your core engagement was strong, and you maintained good stability in your torso.
- **Deviations**: Some joint angles fluctuated during the hold, which usually points to fatigue or small balance shifts.

### 2. Anatomical Alignment Cues
- **Ground down**: Press through all four corners of your feet for a stable base.
- **Shoulder relaxation**: Roll your shoulders back and down, away from your ears.
- **Maintain focus**: Keep your gaze (Drishti) on one fixed point.

### 3. Personal Wellness Advice & Safety
Holding the pose for **${session.hold_time_seconds} seconds** is a solid effort. Focus on alignment over depth, and back out gently if you feel any pinching in the knee or lower back.

*PhysioAlign Attending Coach*
`;
}

export async function generateCritique(session: SessionRow, user: Profile): Promise<string> {
  if (!genAI) return placeholderCritique(session);

  const corrections = Array.from(
    new Set((session.frame_logs || []).map((log: FrameLog) => log.feedbackMessage).filter(Boolean))
  ).filter((msg) => !/Camera Initializing|Show your body|Perfect|out of frame|Step back/i.test(msg));

  const systemInstruction = `
Identity: Your name is PhysioAlign Attending Coach.
Role: You are an expert Clinical Yoga Therapist, Sports Biomechanics Specialist, and OSCE-style Grader.
${traineeProfile(user)}

Core Directives:
1. Give clinically accurate critiques of joint angles, alignment and weight distribution.
2. Be encouraging and supportive but professional.
3. Use markdown headings and bullet points, and highlight key anatomical terms.
4. Given their goal (${user.goal}) and age (${user.age}), include precautions against joint injury.
5. Keep it structured and scannable, without long openings or sign-offs.`;

  const prompt = `
TASK: Generate an OSCE-style yoga pose evaluation report.

Session Details:
- Practiced Pose: ${session.pose_name}
- Total Session Time: ${session.duration_seconds} seconds
- Hold Time in Good Form: ${session.hold_time_seconds} seconds
- Average Accuracy Score: ${session.average_score}/100
- Overall Grade: ${session.grade}

Corrections detected in real time:
${corrections.length ? corrections.map((c) => `- ${c}`).join('\n') : '- None (good posture throughout)'}

Write these sections:
### 1. Biomechanical Analysis
Which muscles were engaged, which joint angles were held well, and which deviations occurred.

### 2. Anatomical Alignment Cues
2-3 specific physical cues for next time.

### 3. Personal Wellness Advice & Safety
Age and experience appropriate advice, and how this pose supports their goal of *${user.goal}*.

Sign off as: "*PhysioAlign Attending Coach*"`;

  return generate(systemInstruction, prompt);
}

const COACH_PROMPTS = {
  anya: `You are Zen Master Anya, a yoga teacher focusing on alignment, breathing (Pranayama), and mindfulness.
You speak in a gentle, warm, encouraging, and zen-like tone. Keep your responses structured, clear, and relatively brief (2-3 paragraphs).`,
  rocky: `You are Coach Rocky, an energetic yoga instructor who focuses on building strength, holding poses longer, and engaging the core.
You speak in an upbeat, motivating tone and encourage the user to push their limits safely. Keep responses brief (2-3 paragraphs).`,
  maya: `You are Dr. Maya, a clinical yoga therapist and rehabilitation specialist.
You help users modify poses for recovery, joint stiffness, lower back pain, or injuries, in a professional and empathetic tone.
Suggest clear and safe variations. Keep responses structured and easy to read (2-3 paragraphs).`,
};

export type CoachId = keyof typeof COACH_PROMPTS;
export const COACH_IDS = Object.keys(COACH_PROMPTS) as CoachId[];

export async function askCoach(
  coachId: CoachId,
  history: { sender: 'user' | 'coach'; text: string }[],
  message: string,
  user: Profile
): Promise<string> {
  if (!genAI) {
    return "Hi! No Gemini API key is configured on the server, so I'm running in offline demo mode. Add GEMINI_API_KEY to enable live answers.";
  }

  const systemInstruction = `${COACH_PROMPTS[coachId]}
${traineeProfile(user)}

Respond with their age and experience in mind. Be concise and friendly, and use short paragraphs or bullet points.`;

  let turns = history.map((m) => ({ role: m.sender === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));
  // gemini wants the history to start with a user turn and not end with one,
  // since sendMessage adds the new user message itself
  while (turns.length && turns[0].role === 'model') turns.shift();
  if (turns.length && turns[turns.length - 1].role === 'user') turns = turns.slice(0, -1);

  let lastError: any;
  for (const modelId of [PRIMARY_MODEL, LITE_MODEL]) {
    try {
      const chat = genAI
        .getGenerativeModel({ model: modelId, systemInstruction })
        .startChat({ history: turns, generationConfig: { maxOutputTokens: 1000, temperature: 0.7 } });
      const result = await chat.sendMessage(message);
      return result.response.text();
    } catch (error) {
      lastError = error;
    }
  }
  console.error('[gemini] Coach chat failed:', lastError?.message);
  return String(lastError?.message).includes('429')
    ? "I've hit my daily limit, please try again tomorrow."
    : "Oops, I couldn't connect just now. Try again in a moment.";
}

export async function doctorInsight(patient: Profile, sessions: SessionRow[]): Promise<string> {
  if (!genAI) {
    return '<p><strong>[Demo Mode]</strong> Reviewing patient history. Recommend focus on core stability, knee alignment during standing poses, and gradual hold extensions.</p>';
  }

  const history = sessions
    .map(toSession)
    .map((s) => `- Pose: ${s.poseName}, Hold: ${s.holdTimeSeconds}/${s.durationSeconds}s, Avg Score: ${s.averageScore}%, Grade: ${s.grade}`)
    .join('\n');

  const prompt = `
Write a clinical physical therapy report card for this patient:
${traineeProfile(patient)}

Recent practice history (last 5 sessions):
${history || 'No sessions logged yet.'}

Write 2 paragraphs:
1. Biomechanical summary of their hold stability, noting fatigue trends or joint risk.
2. A prescriptive plan with target angles or pose modifications matching their goal (${patient.goal}).

Format as clean HTML using <h4>, <p>, <strong>, <ul> and <li>. No markdown fences.`;

  try {
    return await generate(
      'You are Dr. Maya, a senior physical therapy and rehabilitation specialist. You give concise clinical analysis of joint-tracking metrics and safe progression plans.',
      prompt
    );
  } catch {
    return '<p>Failed to generate the insight report. Recommendation: continue daily sessions at low intensity and avoid over-flexing the knees.</p>';
  }
}
