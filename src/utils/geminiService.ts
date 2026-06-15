import { GoogleGenerativeAI } from '@google/generative-ai';
import { SessionData, UserData } from '../game/types';
import { getPoseById } from '../data/poses';

const API_KEY = (import.meta as any).env.VITE_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

const PRIMARY_MODEL = 'gemini-2.5-flash';
const LITE_MODEL = 'gemini-2.5-flash-lite';

const getSystemInstruction = (userData: UserData) => {
  return `
    Identity: Your name is PhysioAlign Attending Coach.
    Role: You are an expert Clinical Yoga Therapist, Sports Biomechanics Specialist, and OSCE-style Grader.
    
    Trainee Profile:
    - Name: ${userData.name}
    - Age: ${userData.age}
    - Yoga Experience: ${userData.experience}
    - Primary Goal: ${userData.goal}
    
    Core Directives:
    1. Expert Biomechanics: Provide professional, clinically accurate critiques of body geometry (joint angles, alignment, weight distribution) in yoga.
    2. Empathetic Coaching: Write with an encouraging, supportive, yet professional clinical tone.
    3. Markdown Formatting: Structure your response with clean headings, bullet points, and highlight key anatomical terms (e.g. *quadriceps*, *patellar alignment*).
    4. Safety & Precautions: Given their goal ("${userData.goal}") and age (${userData.age}), provide specific precautions to prevent joint injury.
    5. Conciseness: Keep responses structured and scannable so a trainee can read it quickly. Avoid verbose opening/closing statements.
  `;
};

/**
 * Generate a detailed, clinical-grade yoga debrief report using Google Gemini AI.
 */
export const generateSessionCritique = async (
  sessionData: SessionData,
  userData: UserData
): Promise<string> => {
  try {
    if (!API_KEY) {
      console.warn('[PhysioAlign Coach] Gemini API Key is missing. Returning simulated critique.');
      return getMockCritique(sessionData);
    }

    const pose = getPoseById(sessionData.poseId);
    const poseName = pose ? pose.name : sessionData.poseName;

    // Summarize the frame logs to avoid sending too much token data, while maintaining precision
    const correctionsTriggered = Array.from(
      new Set(sessionData.frameLogs.flatMap((log) => log.feedbackMessage ? [log.feedbackMessage] : []))
    ).filter(
      (msg) => msg && msg !== 'Camera Initializing...' && !msg.includes('Show your body') && !msg.includes('Perfect form')
    );

    const prompt = `
      TASK: Generate an OSCE-Style Yoga Pose Evaluation Report.
      
      Session Details:
      - Practiced Pose: ${poseName}
      - Total Session Time: ${sessionData.durationSeconds} seconds
      - Hold Time in Perfect Form: ${sessionData.holdTimeSeconds} seconds
      - Average Accuracy Score: ${sessionData.averageScore}/100
      - Overall Grade: ${sessionData.grade}
      
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
      Provide age-appropriate and experience-appropriate suggestions. Mention how this pose supports their goal of *${userData.goal}*.
      
      Sign off as: "*PhysioAlign Attending Coach*"
    `;

    const callCritique = async (modelId: string) => {
      const model = genAI.getGenerativeModel({
        model: modelId,
        systemInstruction: getSystemInstruction(userData),
      });
      const result = await model.generateContent(prompt);
      return result.response.text();
    };

    try {
      return await callCritique(PRIMARY_MODEL);
    } catch (err) {
      console.warn(`[PhysioAlign Coach] Session critique primary model failed, trying fallback:`, err);
      try {
        return await callCritique(LITE_MODEL);
      } catch (liteErr) {
        console.error('[PhysioAlign Coach] Fallback model also failed:', liteErr);
        return getMockCritique(sessionData);
      }
    }
  } catch (error) {
    console.error('[PhysioAlign Coach] Error generating AI critique:', error);
    return getMockCritique(sessionData);
  }
};

/**
 * Fallback static report generator when API key is unavailable or fails
 */
function getMockCritique(session: SessionData): string {
  const pose = getPoseById(session.poseId);
  const poseName = pose ? pose.name : session.poseName;

  return `
### 1. Biomechanical Analysis
Your practice of **${poseName}** was analyzed with an overall accuracy of **${session.averageScore}%**, earning a Grade **${session.grade}**.
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

/**
 * Ask a question to a specific AI Coach persona.
 */
export const askCoachQuestion = async (
  coachSystemPrompt: string,
  chatHistory: { sender: 'user' | 'coach'; text: string }[],
  userMessage: string,
  userData: UserData
): Promise<string> => {
  if (!API_KEY) {
    console.warn('[PhysioAlign Chat] Gemini API Key is missing. Returning mock coach response.');
    return "Hi there! I'm happy to help you with your yoga practice. Since no Gemini API key is configured, I am running in local offline demo mode. Try configuring a VITE_GEMINI_API_KEY in your .env file to enable live AI consultations!";
  }

  const systemInstruction = `
${coachSystemPrompt}

Trainee Profile:
- Name: ${userData.name}
- Age: ${userData.age}
- Yoga Experience: ${userData.experience}
- Primary Goal: ${userData.goal}

Please respond to the user's question keeping your persona, their age, and their experience in mind. Be concise, friendly, and structure your responses with clean paragraphs and bullet points if needed.
  `;

  const callModel = async (modelId: string) => {
    const model = genAI.getGenerativeModel({
      model: modelId,
      systemInstruction: systemInstruction,
    });

    let formattedHistory = chatHistory.map((msg) => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    }));

    // Filter out any leading 'model' messages because Gemini chat history must start with a 'user' message.
    while (formattedHistory.length > 0 && formattedHistory[0].role === 'model') {
      formattedHistory.shift();
    }

    // Defensive check: If the final message in history is from the user, remove it
    // because sendMessage will append the current user message, causing consecutive user turns.
    if (formattedHistory.length > 0 && formattedHistory[formattedHistory.length - 1].role === 'user') {
      formattedHistory = formattedHistory.slice(0, -1);
    }

    const chat = model.startChat({
      history: formattedHistory,
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
      },
    });

    const result = await chat.sendMessage(userMessage);
    return result.response.text();
  };

  try {
    return await callModel(PRIMARY_MODEL);
  } catch (error: any) {
    console.warn(`[PhysioAlign Chat] Primary model ${PRIMARY_MODEL} failed, attempting fallback to ${LITE_MODEL}:`, error);
    try {
      return await callModel(LITE_MODEL);
    } catch (liteError: any) {
      console.error('[PhysioAlign Chat] Both models failed:', liteError);
      if (liteError.message?.includes("429") || error.message?.includes("429")) {
        return "I am currently at my daily limit. Please reach out again tomorrow. PhysioAlign Attending Coach.";
      }
      return "Oops! I ran into an error connecting. Let's try again in a moment.";
    }
  }
};

/**
 * Generate a clinical doctor overview recommendation using Google Gemini AI.
 */
export const generateDoctorInsight = async (
  patientData: UserData,
  history: SessionData[]
): Promise<string> => {
  try {
    if (!API_KEY) {
      return `<div style="padding: 12px; border: 2.5px solid var(--line); background: var(--butter); border-radius: 8px; font-weight: 800; font-size: 14px;">
        <strong>[Demo Mode]</strong> Reviewing patient history. Recommend focus on core stability, knee alignment during standing poses, and gradual hold extensions.
      </div>`;
    }

    const model = genAI.getGenerativeModel({
      model: PRIMARY_MODEL,
      systemInstruction: "You are Dr. Maya, a senior Physical Therapy and Rehabilitation Specialist. You provide concise, clinical analysis of patient joint-tracking metrics and suggest safe, structured physical therapy progression plans.",
    });

    const sessionList = history.slice(0, 5).map(s => 
      `- Pose: ${s.poseName}, Hold: ${s.holdTimeSeconds}/${s.durationSeconds}s, Avg Score: ${s.averageScore}%, Grade: ${s.grade}`
    ).join('\n');

    const prompt = `
      Please write a clinical physical therapy report card and recommendations for patient:
      - Name: ${patientData.name}
      - Age: ${patientData.age}
      - Goal: ${patientData.goal}
      - Experience: ${patientData.experience}

      Recent Practice History (Last 5 sessions):
      ${sessionList || 'No sessions logged yet.'}

      Write a highly professional, 2-paragraph clinical analysis:
      Paragraph 1: Biomechanical summary of their alignment hold stability, noting any potential fatigue trends or joint risk.
      Paragraph 2: Custom prescriptive action plan (specifically noting target angles or modifications to poses matching their goal: ${patientData.goal}).
      
      Format in clean HTML (use headings <h4>, paragraphs <p>, bold text <strong>, and lists <ul>/<li> for structure). Do not include any markdown fences.
    `;

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Failed to generate doctor insights:', error);
    return `<p>Failed to generate insight report. Clinical recommendation: Continue daily calibration sessions at low intensity and avoid over-flexion of the knees.</p>`;
  }
};
