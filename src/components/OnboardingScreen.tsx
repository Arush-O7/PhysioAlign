import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle } from 'lucide-react';
import { store, useUserData } from '../game/store';
import { UserData } from '../game/types';
import { TopBar } from './primitives';
import { useAuth, useUser } from '../utils/auth';

const EXPERIENCE: { value: UserData['experience']; label: string; hint: string }[] = [
  { value: 'beginner', label: 'Beginner', hint: 'New to these poses' },
  { value: 'intermediate', label: 'Intermediate', hint: 'Practise sometimes' },
  { value: 'advanced', label: 'Advanced', hint: 'Practise regularly' },
];

const GOALS: { value: UserData['goal']; label: string; hint: string }[] = [
  { value: 'flexibility', label: 'Flexibility', hint: 'Open up tight areas' },
  { value: 'strength', label: 'Strength', hint: 'Build holding power' },
  { value: 'balance', label: 'Balance', hint: 'Steadier standing poses' },
  { value: 'rehabilitation', label: 'Rehabilitation', hint: 'Recover after injury' },
];

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
    (registrationIntent === 'practice_suite' ? 'patient' : (registrationIntent as UserData['role']));

  const [role] = useState<UserData['role']>(initialRole);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const prefilledRef = useRef(false);

  // prefill the name from the Google profile once, for new accounts
  useEffect(() => {
    if (!existingUser && !prefilledRef.current && user) {
      const googleName = user.fullName || user.firstName || '';
      if (googleName) {
        setName(googleName);
        prefilledRef.current = true;
      }
    }
  }, [user, existingUser]);

  const handleSubmit = async (e: React.FormEvent) => {
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
    setIsSaving(true);
    const saveError = await store.saveOnboarding({
      name: name.trim(),
      age: ageNum,
      experience,
      goal,
      role,
    });
    setIsSaving(false);
    if (saveError) setError(saveError);
  };

  const handleBack = () => {
    store.setScreen(existingUser ? 'dashboard' : 'splash');
  };

  return (
    <div className="screen">
      <TopBar here={0} steps={existingUser ? ['Profile'] : ['Set up profile']} showProfile={!!existingUser} />

      <div className="page">
        <div className="container container--narrow">
          <div className="page-header">
            <div className="page-header__text">
              <h1>{existingUser ? 'Profile settings' : 'Set up your profile'}</h1>
              <p className="page-subtitle">
                {existingUser
                  ? 'Update your details. Scoring thresholds and coaching advice follow these values.'
                  : 'A few details so sessions are scored against sensible ranges and the advice fits your goal.'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="card card--raised">
              <div className="card__body stack stack--lg">
                {error && (
                  <div className="alert alert--danger" role="alert">
                    <AlertCircle size={16} className="alert__icon" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="grid grid--2">
                  <div className="field">
                    <label className="label" htmlFor="name-input">
                      Full name
                    </label>
                    <input
                      id="name-input"
                      className="input"
                      type="text"
                      required
                      maxLength={40}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Doe"
                    />
                    <span className="hint">How coaches and reports address you.</span>
                  </div>

                  <div className="field">
                    <label className="label" htmlFor="age-input">
                      Age
                    </label>
                    <input
                      id="age-input"
                      className="input"
                      type="number"
                      min="5"
                      max="110"
                      required
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="28"
                    />
                    <span className="hint">Used for range-of-motion expectations and safety notes.</span>
                  </div>
                </div>

                <div className="field">
                  <span className="label">Experience level</span>
                  <span className="hint" style={{ marginBottom: 2 }}>
                    Sets the starting hold targets for each pose.
                  </span>
                  <div className="segmented segmented--3">
                    {EXPERIENCE.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`segmented__item${experience === option.value ? ' is-selected' : ''}`}
                        onClick={() => setExperience(option.value)}
                        aria-pressed={experience === option.value}
                      >
                        <span style={{ display: 'block' }}>{option.label}</span>
                        <span className="text-xs muted">{option.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="field">
                  <span className="label">Primary goal</span>
                  <span className="hint" style={{ marginBottom: 2 }}>
                    Shapes your daily plan and the focus of each report.
                  </span>
                  <div className="segmented segmented--2">
                    {GOALS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`segmented__item${goal === option.value ? ' is-selected' : ''}`}
                        onClick={() => setGoal(option.value)}
                        aria-pressed={goal === option.value}
                      >
                        <span style={{ display: 'block' }}>{option.label}</span>
                        <span className="text-xs muted">{option.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="card__footer row spread">
                <button type="button" className="btn btn--ghost" onClick={handleBack}>
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary" disabled={isSaving}>
                  {isSaving && <span className="spinner" style={{ borderColor: 'rgba(255,255,255,0.4)', borderTopColor: '#fff' }} />}
                  {existingUser ? 'Save changes' : 'Continue'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
