import React, { useState, useEffect, useRef } from 'react';
import { store, useUserData } from '../game/store';
import { UserData } from '../game/types';
import { TopBar, PhysioLogo } from './primitives';
import { useAuth, useUser } from '@clerk/clerk-react';

export function OnboardingScreen() {
  const existingUser = useUserData();
  const { userId } = useAuth();
  const { user } = useUser();

  const [name, setName] = useState(existingUser?.name || user?.fullName || user?.firstName || '');
  const [age, setAge] = useState<string>(existingUser?.age ? String(existingUser.age) : '');
  const [experience, setExperience] = useState<UserData['experience']>(existingUser?.experience || 'beginner');
  const [goal, setGoal] = useState<UserData['goal']>(existingUser?.goal || 'flexibility');
  // Read registration role intent from pre-login selection
  const registrationIntent = sessionStorage.getItem('physioalign:registration_intent') || 'patient';
  const initialRole = existingUser?.role || 
    (registrationIntent === 'practice_suite' ? 'patient' : registrationIntent as UserData['role']);

  const [role] = useState<UserData['role']>(initialRole);
  const [error, setError] = useState('');

  // Input focus states for neobrutalist transitions
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [isAgeFocused, setIsAgeFocused] = useState(false);

  const prefilledRef = useRef(false);

  // Auto-prefill the name from Clerk (Google Auth profile) once on mount if the user is new and name is empty
  useEffect(() => {
    if (!existingUser && !prefilledRef.current && user) {
      const clerkName = user.fullName || user.firstName || '';
      if (clerkName) {
        setName(clerkName);
        prefilledRef.current = true;
      }
    }
  }, [user, existingUser]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (name.length > 40) {
      setError('Name is too long (maximum 40 characters).');
      return;
    }
    const ageNum = Number(age);
    if (!age || isNaN(ageNum) || ageNum < 5 || ageNum > 110) {
      setError('Please enter a realistic age between 5 and 110.');
      return;
    }

    setError('');
    const email = user?.primaryEmailAddress?.emailAddress || '';

    store.saveOnboarding({
      name: name.trim(),
      age: ageNum,
      experience,
      goal,
      role
    }, userId, email);
  };

  const handleBack = () => {
    store.setScreen(existingUser ? 'dashboard' : 'splash');
  };

  return (
    <div className="screen" style={{ background: 'var(--cream)' }}>
      <TopBar here={0} steps={existingUser ? ['Profile'] : ['Onboarding']} showProfile={!!existingUser} />

      <div style={{ maxWidth: 560, margin: '40px auto', padding: '0 20px' }} className="popin">
        <form 
          onSubmit={handleSubmit} 
          className="plush" 
          style={{ 
            padding: '36px 32px', 
            background: 'white', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 24 
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, borderBottom: '3.5px dashed var(--line)', paddingBottom: 18 }}>
            <PhysioLogo size={70} />
            <div>
              <h2 style={{ fontSize: 26, color: 'var(--ink)' }}>
                {existingUser ? 'Update Recovery Profile' : 'Set Up Your Care Profile'}
              </h2>
              <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '4px 0 0', fontWeight: 800 }}>
                {existingUser 
                  ? 'Revise your therapist details and wellness coordinates.' 
                  : 'Configure your custom PhysioAlign thresholds and AI recommendations.'}
              </p>
            </div>
          </div>

          {error && (
            <div style={{
              background: '#FFEAE6',
              border: '2.5px solid var(--line)',
              borderRadius: 'var(--r-sm)',
              padding: '10px 14px',
              color: '#FF6B4A',
              fontSize: 13,
              fontWeight: 800,
              boxShadow: '2px 2px 0 var(--line)'
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Name Field */}
          <div>
            <label htmlFor="name-input" style={{ display: 'block', fontWeight: 800, fontSize: 15, color: 'var(--ink)' }}>
              Full Name
            </label>
            <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 8 }}>
              How our AI clinicians and recovery coaches should address you.
            </span>
            <input
              id="name-input"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={() => setIsNameFocused(true)}
              onBlur={() => setIsNameFocused(false)}
              placeholder="Enter your name"
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '3px solid var(--line)',
                borderRadius: 'var(--r-sm)',
                fontSize: 15,
                fontFamily: 'inherit',
                fontWeight: 800,
                color: 'var(--ink)',
                outline: 'none',
                boxShadow: isNameFocused ? '4px 4px 0 var(--line)' : '2px 2px 0 var(--line)',
                transform: isNameFocused ? 'translate(-2px, -2px)' : 'none',
                background: 'white',
                transition: 'all 0.1s ease',
              }}
            />
          </div>

          {/* Age Field */}
          <div>
            <label htmlFor="age-input" style={{ display: 'block', fontWeight: 800, fontSize: 15, color: 'var(--ink)' }}>
              Age
            </label>
            <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 8 }}>
              Calculates normal range-of-motion limits for biomechanical grading.
            </span>
            <input
              id="age-input"
              type="number"
              min="1"
              max="120"
              required
              value={age}
              onChange={(e) => setAge(e.target.value)}
              onFocus={() => setIsAgeFocused(true)}
              onBlur={() => setIsAgeFocused(false)}
              placeholder="Enter your age"
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '3px solid var(--line)',
                borderRadius: 'var(--r-sm)',
                fontSize: 15,
                fontFamily: 'inherit',
                fontWeight: 800,
                color: 'var(--ink)',
                outline: 'none',
                boxShadow: isAgeFocused ? '4px 4px 0 var(--line)' : '2px 2px 0 var(--line)',
                transform: isAgeFocused ? 'translate(-2px, -2px)' : 'none',
                background: 'white',
                transition: 'all 0.1s ease',
              }}
            />
          </div>

          {/* Experience selection */}
          <div>
            <span style={{ display: 'block', fontWeight: 800, fontSize: 15, color: 'var(--ink)' }}>
              Experience Level
            </span>
            <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 10 }}>
              Adjusts baseline pose hold difficulty and skeletal assessment strictness.
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {(['beginner', 'intermediate', 'advanced'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setExperience(level)}
                  style={{
                    padding: '12px',
                    border: '3px solid var(--line)',
                    borderRadius: 'var(--r-sm)',
                    fontFamily: 'inherit',
                    fontSize: 14,
                    fontWeight: 900,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                    boxShadow: experience === level ? '1px 1px 0 var(--line)' : '3px 3px 0 var(--line)',
                    background: experience === level ? 'var(--mint)' : 'white',
                    color: 'var(--ink)',
                    transform: experience === level ? 'translate(2px, 2px)' : 'none',
                    transition: 'all 0.1s ease',
                  }}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Goal selection */}
          <div>
            <span style={{ display: 'block', fontWeight: 800, fontSize: 15, color: 'var(--ink)' }}>
              Primary Wellness Goal
            </span>
            <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 10 }}>
              Customizes daily stretching roadmaps and joint recovery exercises.
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {(['flexibility', 'strength', 'balance', 'rehabilitation'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGoal(g)}
                  style={{
                    padding: '12px',
                    border: '3px solid var(--line)',
                    borderRadius: 'var(--r-sm)',
                    fontFamily: 'inherit',
                    fontSize: 14,
                    fontWeight: 900,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                    boxShadow: goal === g ? '1px 1px 0 var(--line)' : '3px 3px 0 var(--line)',
                    background: goal === g ? 'var(--peach)' : 'white',
                    color: 'var(--ink)',
                    transform: goal === g ? 'translate(2px, 2px)' : 'none',
                    transition: 'all 0.1s ease',
                  }}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>



          {/* Submit/Back Buttons */}
          <div style={{ display: 'flex', gap: 14, marginTop: 12 }}>
            <button
              type="button"
              onClick={handleBack}
              className="btn-plush ghost"
              style={{ flex: 1, padding: '12px', fontSize: 16 }}
            >
              Back
            </button>
            <button
              type="submit"
              className="btn-plush primary"
              style={{ flex: 1, padding: '12px', fontSize: 16 }}
            >
              {existingUser ? 'Save Profile Details ➔' : 'Register Account ➔'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
