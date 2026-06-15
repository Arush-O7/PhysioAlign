import { inngest } from './client.js';
import { dbGet, dbRun } from '../db.js';
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

/**
 * Fallback static report generator when API key is unavailable or fails
 */
function getMockCritique(session) {
  return `
### 1. Biomechanical Analysis
Your practice of **${session.pose_name}** was analyzed with an overall accuracy of **${session.average_score}%**, earning a Grade **${session.grade}**.
- **Strengths**: Your core engagement was strong, and you maintained good stability in your core torso muscles.
- **Deviations**: Some joint angles fluctuated during the hold. Specifically, your joint extension was slightly out of range, indicating minor muscle fatigue or balance shifts.

### 2. Anatomical Alignment Cues
- **Ground down**: Focus on pressing through all four corners of your feet to create a stable foundation.
- **Shoulder relaxation**: Roll your shoulders back and down, away from your ears, to relieve neck tension.
- **Maintain focus**: Keep your gaze (Drishti) fixed on a single stationary point to maintain focus.

### 3. Personal Wellness Advice & Safety
For your level, holding the pose for **${session.hold_time_seconds} seconds** is a solid effort. To support your goals safely, focus on alignment over depth. If you feel any pinching in your knee or lower back, gently back out of the pose.

*PhysioAlign Attending Coach*
  `;
}

// Inngest background worker function
export const generateAICritique = inngest.createFunction(
  { id: 'generate-ai-critique', event: 'session.completed' },
  async ({ event, step }) => {
    const { sessionId, clerkId } = event.data;
    console.log(`[Inngest] Background job started for session: ${sessionId}`);

    // 1. Fetch session data
    const session = await step.run('fetch-session-data', async () => {
      const row = await dbGet('SELECT * FROM sessions WHERE id = ?', [sessionId]);
      if (!row) throw new Error(`Session ${sessionId} not found`);
      return row;
    });

    // 2. Fetch user data
    const user = await step.run('fetch-user-data', async () => {
      const row = await dbGet('SELECT * FROM users WHERE clerk_id = ?', [clerkId]);
      if (!row) throw new Error(`User ${clerkId} not found`);
      return row;
    });

    // 3. Generate critique using Gemini AI
    const critique = await step.run('call-gemini-ai', async () => {
      const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
      if (!apiKey) {
        console.warn('[Inngest] No Gemini API key found. Generating fallback critique.');
        return getMockCritique(session);
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      
      // Parse frame logs from db
      let frameLogs = [];
      try {
        if (session.frame_logs) {
          frameLogs = JSON.parse(session.frame_logs);
        }
      } catch (e) {
        console.error('[Inngest] Failed to parse frame logs:', e);
      }

      const correctionsTriggered = Array.from(
        new Set(frameLogs.flatMap((log) => log.feedbackMessage ? [log.feedbackMessage] : []))
      ).filter(
        (msg) => msg && msg !== 'Camera Initializing...' && !msg.includes('Show your body') && !msg.includes('Perfect form')
      );

      const prompt = `
        TASK: Generate an OSCE-Style Yoga Pose Evaluation Report.
        
        Session Details:
        - Practiced Pose: ${session.pose_name}
        - Total Session Time: ${session.duration_seconds} seconds
        - Hold Time in Perfect Form: ${session.hold_time_seconds} seconds
        - Average Accuracy Score: ${session.average_score}/100
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
        console.warn(`[Inngest] Primary model ${PRIMARY_MODEL} failed, trying fallback:`, err);
        try {
          return await callCritique(LITE_MODEL);
        } catch (liteErr) {
          console.error('[Inngest] Fallback model also failed:', liteErr);
          return getMockCritique(session);
        }
      }
    });

    // 4. Save critique to DB
    await step.run('save-critique-to-db', async () => {
      await dbRun('UPDATE sessions SET ai_critique = ? WHERE id = ?', [critique, sessionId]);
      console.log(`[Inngest] AI Critique successfully updated in database for session: ${sessionId}`);
    });

    return { success: true, sessionId };
  }
);
