import { GoogleGenerativeAI } from '@google/generative-ai';

const PRIMARY_MODEL = 'gemini-2.5-flash';
const LITE_MODEL = 'gemini-2.5-flash-lite';

const getSystemInstruction = (userData) => {
  return `
    Identity: Your name is PhysioAlign Attending Coach.
    Role: You are an expert Clinical Yoga Therapist, Sports Biomechanics Specialist, and OSCE-style Grader.
    
    Trainee Profile:
    - Name: ${userData.name}
    - Age: ${userData.age}
    - Yoga Experience: ${userData.experience}
    - Goal: ${userData.goal}
    
    Core Directives:
    1. Expert Biomechanics: Provide professional, clinically accurate critiques of body geometry (joint angles, alignment, weight distribution) in yoga.
    2. Empathetic Coaching: Write with an encouraging, supportive, yet professional clinical tone.
    3. Markdown Formatting: Structure your response with clean headings, bullet points, and highlight key anatomical terms (e.g. *quadriceps*, *patellar alignment*).
    4. Safety & Precautions: Given their goal ("${userData.goal}") and age (${userData.age}), provide specific precautions to prevent joint injury.
    5. Conciseness: Keep responses structured and scannable. Avoid verbose opening/closing statements.
  `;
};

function getMockCritique(session) {
  return `
### 1. Biomechanical Analysis
Your practice of **${session.poseName}** was analyzed with an overall accuracy of **${session.averageScore}%**, earning a Grade **${session.grade}**.
- **Strengths**: Your core engagement was strong, and you maintained good stability in your core torso muscles.
- **Deviations**: Some joint angles fluctuated during the hold. Specifically, your joint extension was slightly out of range, indicating minor muscle fatigue or balance shifts.

### 2. Anatomical Alignment Cues
- **Ground down**: Focus on pressing through all four corners of your feet to create a stable foundation.
- **Shoulder relaxation**: Roll your shoulders back and down, away from your ears, to relieve neck tension.
- **Maintain focus**: Keep your gaze (Drishti) fixed on a single stationary point to maintain focus.

### 3. Personal Wellness Advice & Safety
For your level, holding the pose for **${session.holdTimeSeconds} seconds** is a solid effort. To support your goals safely, focus on alignment over depth. If you feel any pinching in your knee or lower back, gently back out of the pose.

*PhysioAlign Attending Coach*
  `;
}

// GEMINI_API_KEY is preferred. the VITE_ name still works so old .env files don't break,
// and since the frontend no longer reads it, it doesn't end up in the bundle
const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export const generateAICritiqueSync = async (session, user) => {
  if (!genAI) {
    console.warn('[PhysioAlign] No Gemini API key found. Generating fallback critique.');
    return getMockCritique(session);
  }
  
  const correctionsTriggered = Array.from(
    new Set((session.frameLogs || []).flatMap((log) => log.feedbackMessage ? [log.feedbackMessage] : []))
  ).filter(
    (msg) => msg && msg !== 'Camera Initializing...' && !msg.includes('Show your body') && !msg.includes('Perfect form')
  );

  const prompt = `
    TASK: Generate an OSCE-Style Yoga Pose Evaluation Report.
    
    Session Details:
    - Practiced Pose: ${session.poseName}
    - Total Session Time: ${session.durationSeconds} seconds
    - Hold Time in Perfect Form: ${session.holdTimeSeconds} seconds
    - Average Accuracy Score: ${session.averageScore}/100
    - Overall Grade: ${session.grade}
    
    Biomechanical Correction Logs (Issues detected in real-time):
    ${correctionsTriggered.length > 0 
      ? correctionsTriggered.map((c) => `- ${c}`).join('\n') 
      : '- None (Perfect posture maintained throughout)'}
    
    Please provide a structured report with the following sections:
    ### 1. Biomechanical Analysis
    Analyze which muscles were correctly activated, what joint angles were well-maintained, and what specific skeletal deviations occurred (based on the corrections logged).
    
    ### 2. Anatomical Alignment Cues
    Give 2-3 specific, physical cues to correct the posture next time (e.g., "Roll your shoulders back", "Stack the front knee over the ankle").
    
    ### 3. Personal Wellness Advice & Safety
    Provide age-appropriate and experience-appropriate suggestions. Mention how this pose supports their goal of *${user.goal}*.
    
    Sign off as: "*PhysioAlign Attending Coach*"
  `;

  const callCritique = async (modelId) => {
    const model = genAI.getGenerativeModel({
      model: modelId,
      systemInstruction: getSystemInstruction(user),
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
  };

  try {
    return await callCritique(PRIMARY_MODEL);
  } catch (err) {
    console.warn(`[PhysioAlign] Primary model ${PRIMARY_MODEL} failed, trying fallback:`, err);
    try {
      return await callCritique(LITE_MODEL);
    } catch (liteErr) {
      console.error('[PhysioAlign] Fallback model also failed:', liteErr);
      return getMockCritique(session);
    }
  }
};

const COACH_PROMPTS = {
  anya: `You are Zen Master Anya, a yoga teacher focusing on alignment, breathing (Pranayama), and mindfulness.
You speak in a gentle, warm, encouraging, and zen-like tone. Keep your responses structured, clear, and relatively brief (2-3 paragraphs).
Give helpful, constructive yoga pointers.`,
  rocky: `You are Coach Rocky, an energetic, athletic, and enthusiastic yoga instructor who focuses on building strength, holding poses longer, and engaging the core.
You speak in an upbeat, motivating, and positive tone. Encourage the user to push their limits safely. Keep your responses brief and highly motivating (2-3 paragraphs).`,
  maya: `You are Dr. Maya, a clinical yoga therapist and rehabilitation specialist.
You help users modify yoga poses to accommodate physical recovery, joint stiffness, lower back pain, or injuries.
Speak in a professional, empathetic, and knowledgeable clinical tone. Suggest clear and safe variations. Keep your responses structured and easy to read (2-3 paragraphs).`,
};

export const COACH_IDS = Object.keys(COACH_PROMPTS);

export const askCoach = async (coachId, chatHistory, userMessage, user) => {
  if (!genAI) {
    return "Hi there! I'm happy to help with your practice, but no Gemini API key is configured on the server so I'm running in offline demo mode. Add GEMINI_API_KEY to the backend .env to enable live answers.";
  }

  const systemInstruction = `
${COACH_PROMPTS[coachId]}

Trainee Profile:
- Name: ${user.name}
- Age: ${user.age}
- Yoga Experience: ${user.experience}
- Primary Goal: ${user.goal}

Please respond to the user's question keeping your persona, their age, and their experience in mind. Be concise, friendly, and structure your responses with clean paragraphs and bullet points if needed.
  `;

  let history = chatHistory
    .filter((msg) => msg && typeof msg.text === 'string')
    .map((msg) => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    }));

  // gemini wants the history to start with a user turn and not end with one,
  // since sendMessage adds the new user message itself
  while (history.length > 0 && history[0].role === 'model') history.shift();
  if (history.length > 0 && history[history.length - 1].role === 'user') history = history.slice(0, -1);

  const callModel = async (modelId) => {
    const model = genAI.getGenerativeModel({ model: modelId, systemInstruction });
    const chat = model.startChat({
      history,
      generationConfig: { maxOutputTokens: 1000, temperature: 0.7 },
    });
    const result = await chat.sendMessage(userMessage);
    return result.response.text();
  };

  try {
    return await callModel(PRIMARY_MODEL);
  } catch (error) {
    console.warn(`[PhysioAlign Chat] ${PRIMARY_MODEL} failed, trying ${LITE_MODEL}:`, error.message);
    try {
      return await callModel(LITE_MODEL);
    } catch (liteError) {
      console.error('[PhysioAlign Chat] Both models failed:', liteError.message);
      if (liteError.message?.includes('429') || error.message?.includes('429')) {
        return "I've hit my daily limit, please try again tomorrow.";
      }
      return "Oops, I couldn't connect just now. Try again in a moment.";
    }
  }
};

export const generateDoctorInsight = async (patient, sessions) => {
  if (!genAI) {
    return `<div style="padding: 12px; border: 2.5px solid var(--line); background: var(--butter); border-radius: 8px; font-weight: 800; font-size: 14px;">
      <strong>[Demo Mode]</strong> Reviewing patient history. Recommend focus on core stability, knee alignment during standing poses, and gradual hold extensions.
    </div>`;
  }

  const sessionList = sessions.map((s) =>
    `- Pose: ${s.poseName}, Hold: ${s.holdTimeSeconds}/${s.durationSeconds}s, Avg Score: ${s.averageScore}%, Grade: ${s.grade}`
  ).join('\n');

  const prompt = `
    Please write a clinical physical therapy report card and recommendations for patient:
    - Name: ${patient.name}
    - Age: ${patient.age}
    - Goal: ${patient.goal}
    - Experience: ${patient.experience}

    Recent Practice History (Last 5 sessions):
    ${sessionList || 'No sessions logged yet.'}

    Write a highly professional, 2-paragraph clinical analysis:
    Paragraph 1: Biomechanical summary of their alignment hold stability, noting any potential fatigue trends or joint risk.
    Paragraph 2: Custom prescriptive action plan (specifically noting target angles or modifications to poses matching their goal: ${patient.goal}).

    Format in clean HTML (use headings <h4>, paragraphs <p>, bold text <strong>, and lists <ul>/<li> for structure). Do not include any markdown fences.
  `;

  try {
    const model = genAI.getGenerativeModel({
      model: PRIMARY_MODEL,
      systemInstruction: 'You are Dr. Maya, a senior Physical Therapy and Rehabilitation Specialist. You provide concise, clinical analysis of patient joint-tracking metrics and suggest safe, structured physical therapy progression plans.',
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('[PhysioAlign] Doctor insight failed:', error.message);
    return '<p>Failed to generate insight report. Clinical recommendation: Continue daily calibration sessions at low intensity and avoid over-flexion of the knees.</p>';
  }
};
