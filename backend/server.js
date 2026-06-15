import 'dotenv/config'; // Load environment variables from .env on startup
import express from 'express';
import cors from 'cors';
import { initDB, dbRun, dbGet, dbAll } from './db.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inngest Event Platform Integration
import { serve } from 'inngest/express';
import { inngest } from './inngest/client.js';
import { generateAICritique } from './inngest/functions.js';

const app = express();
const PORT = process.env.PORT || 5001;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Mount Inngest Serve Middleware endpoint
// The Inngest dev server / cloud platform will reach out to this route to invoke background jobs
app.use('/api/inngest', serve({ client: inngest, functions: [generateAICritique] }));

// Initialize Database Schemas on Startup
initDB().then(() => {
  console.log('[PhysioAlign Backend] Database initialized.');
});

// --- API Endpoints ---

// 1. Get user profile
app.get('/api/users/:clerkId', async (req, res) => {
  const { clerkId } = req.params;
  try {
    const user = await dbGet('SELECT * FROM users WHERE clerk_id = ?', [clerkId]);
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ error: 'User profile not found' });
    }
  } catch (error) {
    console.error('Fetch user failed:', error);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// 2. Create or Update user profile (Upsert)
app.post('/api/users', async (req, res) => {
  const { clerkId, name, email, age, experience, goal, role } = req.body;
  if (!clerkId || !name) {
    return res.status(400).json({ error: 'Missing required fields: clerkId or name' });
  }

  const userRole = role || 'patient';

  try {
    const existingUser = await dbGet('SELECT * FROM users WHERE clerk_id = ?', [clerkId]);
    
    if (existingUser) {
      // Once registered, access roles should not change during general profile edits
      await dbRun(
        'UPDATE users SET name = ?, email = ?, age = ?, experience = ?, goal = ? WHERE clerk_id = ?',
        [name, email, age, experience, goal, clerkId]
      );
      console.log(`[PhysioAlign Backend] Profile updated for user: ${clerkId}`);
    } else {
      await dbRun(
        'INSERT INTO users (clerk_id, name, email, age, experience, goal, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [clerkId, name, email, age, experience, goal, userRole]
      );
      console.log(`[PhysioAlign Backend] Profile created for user: ${clerkId} (${userRole})`);
    }

    const updatedUser = await dbGet('SELECT * FROM users WHERE clerk_id = ?', [clerkId]);
    res.json(updatedUser);
  } catch (error) {
    console.error('Upsert user failed:', error);
    res.status(500).json({ error: 'Database update failed' });
  }
});

// 3. Save a finished yoga evaluation session (Triggers background Inngest AI critique)
app.post('/api/sessions', async (req, res) => {
  const {
    id,
    clerkId,
    poseId,
    poseName,
    date,
    durationSeconds,
    holdTimeSeconds,
    averageScore,
    grade,
    frameLogs
  } = req.body;

  if (!id || !clerkId || !poseId || !poseName) {
    return res.status(400).json({ error: 'Missing required session parameters' });
  }

  try {
    const serializedLogs = JSON.stringify(frameLogs || []);

    // Save the session details immediately with a placeholder status for the AI critique
    await dbRun(
      `INSERT INTO sessions (
        id, clerk_id, pose_id, pose_name, date, 
        duration_seconds, hold_time_seconds, average_score, 
        grade, ai_critique, frame_logs
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, clerkId, poseId, poseName, date,
        durationSeconds, holdTimeSeconds, averageScore,
        grade, 'Generating...', serializedLogs
      ]
    );

    console.log(`[PhysioAlign Backend] Session logs stored. Triggering background Inngest AI critique for: ${id}`);

    // Fire the background event asynchronously via Inngest and return immediately
    await inngest.send({
      name: 'session.completed',
      data: {
        sessionId: id,
        clerkId: clerkId
      }
    });

    res.status(201).json({ success: true, sessionId: id, status: 'Critique generating in background' });
  } catch (error) {
    console.error('Save session failed:', error);
    res.status(500).json({ error: 'Database insert failed' });
  }
});

// 4. Fetch all sessions for a specific user
app.get('/api/sessions/:clerkId', async (req, res) => {
  const { clerkId } = req.params;
  try {
    const rows = await dbAll('SELECT * FROM sessions WHERE clerk_id = ? ORDER BY date DESC', [clerkId]);
    
    const sessions = rows.map(row => {
      let frameLogs = [];
      try {
        if (row.frame_logs) {
          frameLogs = JSON.parse(row.frame_logs);
        }
      } catch (e) {
        console.error('Failed to parse frame logs for session:', row.id, e);
      }

      return {
        id: row.id,
        clerkId: row.clerk_id,
        poseId: row.pose_id,
        poseName: row.pose_name,
        date: row.date,
        durationSeconds: row.duration_seconds,
        holdTimeSeconds: row.hold_time_seconds,
        averageScore: row.average_score,
        grade: row.grade,
        aiCritique: row.ai_critique,
        frameLogs
      };
    });

    res.json(sessions);
  } catch (error) {
    console.error('Fetch sessions failed:', error);
    res.status(500).json({ error: 'Database fetch failed' });
  }
});

// 5. Fetch details of a single session (for polling status checks)
app.get('/api/sessions/detail/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const row = await dbGet('SELECT * FROM sessions WHERE id = ?', [id]);
    if (row) {
      let frameLogs = [];
      try {
        if (row.frame_logs) {
          frameLogs = JSON.parse(row.frame_logs);
        }
      } catch (e) {
        console.error('Failed to parse single session frame logs:', e);
      }

      res.json({
        id: row.id,
        clerkId: row.clerk_id,
        poseId: row.pose_id,
        poseName: row.pose_name,
        date: row.date,
        durationSeconds: row.duration_seconds,
        holdTimeSeconds: row.hold_time_seconds,
        averageScore: row.average_score,
        grade: row.grade,
        aiCritique: row.ai_critique,
        frameLogs
      });
    } else {
      res.status(404).json({ error: 'Session log entry not found' });
    }
  } catch (error) {
    console.error('Fetch single session failed:', error);
    res.status(500).json({ error: 'Database fetch failed' });
  }
});

// 6. Delete a session log entry
app.delete('/api/sessions/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await dbRun('DELETE FROM sessions WHERE id = ?', [id]);
    if (result.changes > 0) {
      console.log(`[PhysioAlign Backend] Deleted session: ${id}`);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Session log entry not found' });
    }
  } catch (error) {
    console.error('Delete session failed:', error);
    res.status(500).json({ error: 'Database delete failed' });
  }
});

// --- DOCTOR PORTAL APIs ---

// Get all patient profiles with aggregated session counts and average scores
app.get('/api/doctor/patients', async (req, res) => {
  try {
    const patients = await dbAll(`
      SELECT 
        u.clerk_id, u.name, u.email, u.age, u.experience, u.goal, u.role, u.doctor_id, u.care_plan,
        COUNT(s.id) as sessionCount,
        AVG(s.average_score) as avgScore
      FROM users u
      LEFT JOIN sessions s ON u.clerk_id = s.clerk_id
      WHERE u.role = 'patient'
      GROUP BY u.clerk_id, u.name, u.email, u.age, u.experience, u.goal, u.role, u.doctor_id, u.care_plan
      ORDER BY u.name ASC
    `);
    
    // SQLite returns averages as numbers, but we map to ensure clean integer averages
    const formatted = patients.map(p => ({
      ...p,
      sessionCount: Number(p.sessionCount || 0),
      avgScore: p.avgScore ? Math.round(Number(p.avgScore)) : 0
    }));
    
    res.json(formatted);
  } catch (error) {
    console.error('Fetch doctor patients failed:', error);
    res.status(500).json({ error: 'Failed to fetch patients list' });
  }
});

// Update care plan for a patient
app.post('/api/doctor/patients/:clerkId/care-plan', async (req, res) => {
  const { clerkId } = req.params;
  const { carePlan } = req.body;
  try {
    const serializedPlan = JSON.stringify(carePlan || []);
    await dbRun('UPDATE users SET care_plan = ? WHERE clerk_id = ?', [serializedPlan, clerkId]);
    console.log(`[PhysioAlign Backend] Doctor updated care plan for patient: ${clerkId}`);
    res.json({ success: true, carePlan });
  } catch (error) {
    console.error('Update care plan failed:', error);
    res.status(500).json({ error: 'Failed to update patient care plan' });
  }
});

// Get session logs for a specific patient
app.get('/api/doctor/patients/:clerkId/history', async (req, res) => {
  const { clerkId } = req.params;
  try {
    const sessions = await dbAll('SELECT * FROM sessions WHERE clerk_id = ? ORDER BY date DESC', [clerkId]);
    const parsed = sessions.map(s => ({
      ...s,
      frameLogs: s.frame_logs ? JSON.parse(s.frame_logs) : []
    }));
    res.json(parsed);
  } catch (error) {
    console.error('Fetch patient history failed:', error);
    res.status(500).json({ error: 'Failed to fetch patient history logs' });
  }
});


// --- ADMIN PORTAL APIs ---

// Get system monitoring and diagnostic telemetry stats
app.get('/api/admin/stats', async (req, res) => {
  try {
    const totalUsersObj = await dbGet('SELECT COUNT(*) as count FROM users');
    const patientsObj = await dbGet("SELECT COUNT(*) as count FROM users WHERE role = 'patient'");
    const doctorsObj = await dbGet("SELECT COUNT(*) as count FROM users WHERE role = 'doctor'");
    const sessionsObj = await dbGet('SELECT COUNT(*) as count FROM sessions');
    
    let dbSize = 'Cloud Storage';
    if (!process.env.DATABASE_URL) {
      try {
        const dbPath = path.resolve(__dirname, 'database.sqlite');
        if (fs.existsSync(dbPath)) {
          const stats = fs.statSync(dbPath);
          dbSize = (stats.size / 1024 / 1024).toFixed(2) + ' MB';
        } else {
          dbSize = '0.05 MB';
        }
      } catch (e) {
        dbSize = 'Unknown';
      }
    }
    
    res.json({
      totalUsers: totalUsersObj ? totalUsersObj.count : 0,
      patients: patientsObj ? patientsObj.count : 0,
      doctors: doctorsObj ? doctorsObj.count : 0,
      sessions: sessionsObj ? sessionsObj.count : 0,
      dbEngine: process.env.DATABASE_URL ? 'Neon Postgres (Cloud)' : 'SQLite (Local File)',
      dbSize: dbSize,
      uptime: Math.round(process.uptime()) + 's'
    });
  } catch (error) {
    console.error('Fetch admin stats failed:', error);
    res.status(500).json({ error: 'Failed to fetch administrator statistics' });
  }
});

// Get user directory for administrative role updates & account deletions
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await dbAll('SELECT * FROM users ORDER BY role DESC, name ASC');
    res.json(users);
  } catch (error) {
    console.error('Fetch admin users failed:', error);
    res.status(500).json({ error: 'Failed to fetch user directory' });
  }
});

// Update a user's role
app.post('/api/admin/users/:clerkId/role', async (req, res) => {
  const { clerkId } = req.params;
  const { role } = req.body;
  if (!role || !['patient', 'doctor', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid or missing role' });
  }
  
  try {
    const result = await dbRun('UPDATE users SET role = ? WHERE clerk_id = ?', [role, clerkId]);
    if (result.changes > 0) {
      console.log(`[PhysioAlign Backend] Admin updated role for user: ${clerkId} -> ${role}`);
      res.json({ success: true, role });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    console.error('Update user role failed:', error);
    res.status(500).json({ error: 'Failed to modify user access role' });
  }
});

// Assign a doctor to a patient
app.post('/api/admin/users/:clerkId/doctor', async (req, res) => {
  const { clerkId } = req.params;
  const { doctorId } = req.body;
  try {
    await dbRun('UPDATE users SET doctor_id = ? WHERE clerk_id = ?', [doctorId || null, clerkId]);
    console.log(`[PhysioAlign Backend] Admin assigned doctor: ${doctorId} to patient: ${clerkId}`);
    res.json({ success: true, doctorId });
  } catch (error) {
    console.error('Assign doctor failed:', error);
    res.status(500).json({ error: 'Failed to assign doctor' });
  }
});

// Delete user account (Cascades session deletes natively in SQL)
app.delete('/api/admin/users/:clerkId', async (req, res) => {
  const { clerkId } = req.params;
  try {
    const result = await dbRun('DELETE FROM users WHERE clerk_id = ?', [clerkId]);
    if (result.changes > 0) {
      console.log(`[PhysioAlign Backend] Admin deleted user account: ${clerkId}`);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'User account not found' });
    }
  } catch (error) {
    console.error('Delete user account failed:', error);
    res.status(500).json({ error: 'Failed to delete user profile from system' });
  }
});

// Start listening
app.listen(PORT, () => {
  console.log(`[PhysioAlign Backend] Server running on port ${PORT}`);
});
