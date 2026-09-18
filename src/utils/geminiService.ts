import { UserData } from '../game/types';
import { apiFetch } from './api';

// gemini is only called from the backend so the api key never reaches the browser

export const askCoachQuestion = async (
  coachId: string,
  chatHistory: { sender: 'user' | 'coach'; text: string }[],
  userMessage: string
): Promise<string> => {
  try {
    const res = await apiFetch('/api/coach/chat', {
      method: 'POST',
      body: JSON.stringify({ coachId, history: chatHistory, message: userMessage }),
    });
    const data = await res.json();
    if (!res.ok) return data.error || "Oops, I couldn't connect just now. Try again in a moment.";
    return data.reply;
  } catch (error) {
    console.error('[PhysioAlign Chat] Request failed:', error);
    return "Oops, I couldn't connect just now. Try again in a moment.";
  }
};

export const generateDoctorInsight = async (
  patient: UserData & { id: string }
): Promise<string> => {
  const res = await apiFetch(`/api/doctor/patients/${patient.id}/insight`, { method: 'POST' });
  if (!res.ok) {
    return '<p>Error generating report. Please try again.</p>';
  }
  const data = await res.json();
  return data.insight;
};
