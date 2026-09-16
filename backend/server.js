import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDB, dbRun, dbGet, dbAll } from './db.js';
import { generateAICritiqueSync } from './gemini.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
// frame logs are sent with every session, 100kb default is too small for long holds
app.use(express.json({ limit: '5mb' }));

const ROLES = ['patient', 'doctor', 'admin'];

// Hash password with salt using built-in crypto (PBKDF2)
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

// Verify password using PBKDF2
function verifyPassword(password, storedValue) {
  if (!storedValue || !storedValue.includes(':')) return false;
  const [salt, originalHash] = storedValue.split(':');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512');
  const expected = Buffer.from(originalHash, 'hex');
  return expected.length === hash.length && crypto.timingSafeEqual(hash, expected);
}

function stripSecrets(user) {
  if (!user) return user;
  const { password_hash, ...rest } = user;
  return rest;
}

function parseFrameLogs(row) {
  if (!row.frame_logs) return [];
  try {
    return JSON.parse(row.frame_logs);
  } catch (e) {
    console.error('Failed to parse frame logs for session:', row.id, e);
    return [];
  }
}

// db rows are snake_case, the frontend expects camelCase
function toSession(row) {
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
    frameLogs: parseFrameLogs(row)
  };
}

// Sign up a new user with email and password
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields: name, email, or password' });
  }

  const userRole = role || 'patient';
  if (!ROLES.includes(userRole)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  const emailLower = email.toLowerCase().trim();

  try {
    const existingUser = await dbGet('SELECT * FROM users WHERE LOWER(email) = ?', [emailLower]);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const customId = `usr_${crypto.randomBytes(8).toString('hex')}`;
    const passwordHash = hashPassword(password);

    await dbRun(
      'INSERT INTO users (clerk_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [customId, name, emailLower, passwordHash, userRole]
    );

    console.log(`[PhysioAlign Backend] Custom email account created: ${customId} (${userRole})`);

    const newUser = await dbGet('SELECT clerk_id, name, email, role FROM users WHERE clerk_id = ?', [customId]);
    res.json(newUser);
  } catch (error) {
    console.error('Signup failed:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// Log in an existing user with email and password
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing required fields: email or password' });
  }

  const emailLower = email.toLowerCase().trim();

  try {
    const user = await dbGet('SELECT * FROM users WHERE LOWER(email) = ? AND password_hash IS NOT NULL', [emailLower]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isValid = verifyPassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    console.log(`[PhysioAlign Backend] Custom email login successful for: ${user.clerk_id}`);
    
    res.json(stripSecrets(user));
  } catch (error) {
    console.error('Login failed:', error);
    res.status(500).json({ error: 'Failed to authenticate' });
  }
});

// Fetch user profile
app.get('/api/users/:clerkId', async (req, res) => {
  const { clerkId } = req.params;
  try {
    const user = await dbGet('SELECT * FROM users WHERE clerk_id = ?', [clerkId]);
    if (user) {
      res.json(stripSecrets(user));
    } else {
      res.status(404).json({ error: 'User profile not found' });
    }
  } catch (error) {
    console.error('Fetch user failed:', error);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// Upsert user profile
app.post('/api/users', async (req, res) => {
  const { clerkId, name, email, age, experience, goal, role } = req.body;
  if (!clerkId || !name) {
    return res.status(400).json({ error: 'Missing required fields: clerkId or name' });
  }

  const userRole = role || 'patient';
  if (!ROLES.includes(userRole)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    const existingUser = await dbGet('SELECT * FROM users WHERE clerk_id = ?', [clerkId]);
    
    if (existingUser) {
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
    res.json(stripSecrets(updatedUser));
  } catch (error) {
    console.error('Upsert user failed:', error);
    res.status(500).json({ error: 'Database update failed' });
  }
});

// Save session and generate AI review synchronously
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

    // 1. Fetch user data for personalized AI system prompt instructions
    const user = await dbGet('SELECT * FROM users WHERE clerk_id = ?', [clerkId]);
    if (!user) {
      return res.status(404).json({ error: 'User profile not found for session' });
    }

    // 2. Generate AI critique synchronously
    console.log(`[PhysioAlign Backend] Generating synchronous AI critique for session: ${id}`);
    const aiCritique = await generateAICritiqueSync(req.body, user);

    // 3. Save session to local SQLite database
    await dbRun(
      `INSERT INTO sessions (
        id, clerk_id, pose_id, pose_name, date, 
        duration_seconds, hold_time_seconds, average_score, 
        grade, ai_critique, frame_logs
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, clerkId, poseId, poseName, date,
        durationSeconds, holdTimeSeconds, averageScore,
        grade, aiCritique, serializedLogs
      ]
    );

    console.log(`[PhysioAlign Backend] Session successfully saved with AI Critique for: ${id}`);

    // Return the saved session object with the AI critique included
    res.status(201).json({
      id,
      clerkId,
      poseId,
      poseName,
      date,
      durationSeconds,
      holdTimeSeconds,
      averageScore,
      grade,
      aiCritique,
      frameLogs
    });
  } catch (error) {
    console.error('Save session failed:', error);
    res.status(500).json({ error: 'Database insert failed' });
  }
});

// Fetch user sessions
app.get('/api/sessions/:clerkId', async (req, res) => {
  const { clerkId } = req.params;
  try {
    const rows = await dbAll('SELECT * FROM sessions WHERE clerk_id = ? ORDER BY date DESC', [clerkId]);
    
    res.json(rows.map(toSession));
  } catch (error) {
    console.error('Fetch sessions failed:', error);
    res.status(500).json({ error: 'Database fetch failed' });
  }
});

// Fetch single session detail
app.get('/api/sessions/detail/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const row = await dbGet('SELECT * FROM sessions WHERE id = ?', [id]);
    if (row) {
      res.json(toSession(row));
    } else {
      res.status(404).json({ error: 'Session log entry not found' });
    }
  } catch (error) {
    console.error('Fetch single session failed:', error);
    res.status(500).json({ error: 'Database fetch failed' });
  }
});

// Delete session
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

// Doctor Portal APIs
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

// Update care plan
app.post('/api/doctor/patients/:clerkId/care-plan', async (req, res) => {
  const { clerkId } = req.params;
  const { carePlan } = req.body;
  try {
    const serializedPlan = JSON.stringify(carePlan || []);
    const result = await dbRun('UPDATE users SET care_plan = ? WHERE clerk_id = ?', [serializedPlan, clerkId]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    console.log(`[PhysioAlign Backend] Doctor updated care plan for patient: ${clerkId}`);
    res.json({ success: true, carePlan });
  } catch (error) {
    console.error('Update care plan failed:', error);
    res.status(500).json({ error: 'Failed to update patient care plan' });
  }
});

// Get patient history
app.get('/api/doctor/patients/:clerkId/history', async (req, res) => {
  const { clerkId } = req.params;
  try {
    const sessions = await dbAll('SELECT * FROM sessions WHERE clerk_id = ? ORDER BY date DESC', [clerkId]);
    res.json(sessions.map(toSession));
  } catch (error) {
    console.error('Fetch patient history failed:', error);
    res.status(500).json({ error: 'Failed to fetch patient history logs' });
  }
});

// Admin Portal APIs
app.get('/api/admin/stats', async (req, res) => {
  try {
    const totalUsersObj = await dbGet('SELECT COUNT(*) as count FROM users');
    const patientsObj = await dbGet("SELECT COUNT(*) as count FROM users WHERE role = 'patient'");
    const doctorsObj = await dbGet("SELECT COUNT(*) as count FROM users WHERE role = 'doctor'");
    const sessionsObj = await dbGet('SELECT COUNT(*) as count FROM sessions');
    
    let dbSize = 'Unknown';
    try {
      const dbSizeObj = await dbGet("SELECT pg_size_pretty(pg_database_size(current_database())) as size");
      dbSize = dbSizeObj ? dbSizeObj.size : 'Unknown';
    } catch (e) {
      dbSize = 'Unknown';
    }
    
    res.json({
      totalUsers: totalUsersObj ? Number(totalUsersObj.count) : 0,
      patients: patientsObj ? Number(patientsObj.count) : 0,
      doctors: doctorsObj ? Number(doctorsObj.count) : 0,
      sessions: sessionsObj ? Number(sessionsObj.count) : 0,
      dbEngine: 'Supabase (PostgreSQL)',
      dbSize: dbSize,
      uptime: Math.round(process.uptime()) + 's'
    });
  } catch (error) {
    console.error('Fetch admin stats failed:', error);
    res.status(500).json({ error: 'Failed to fetch administrator statistics' });
  }
});

// Get all users
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await dbAll('SELECT * FROM users ORDER BY role DESC, name ASC');
    res.json(users.map(stripSecrets));
  } catch (error) {
    console.error('Fetch admin users failed:', error);
    res.status(500).json({ error: 'Failed to fetch user directory' });
  }
});

// Update user role
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

// Assign doctor to patient
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

// Delete user account
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

// unknown api routes should 404 instead of falling through to index.html
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Serve static files from the React frontend built folder
app.use(express.static(path.join(__dirname, '../dist')));

// Serve index.html for all other routes so React Router/screen routing works in production
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`[PhysioAlign Backend] Server running on port ${PORT}`);
  });
});
