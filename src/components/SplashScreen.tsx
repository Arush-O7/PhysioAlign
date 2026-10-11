import { ArrowRight } from 'lucide-react';
import { store } from '../game/store';
import { PhysioLogo } from './primitives';

export function SplashScreen() {
  return (
    <div className="screen screen--centered">
      <div className="stack fade-in" style={{ maxWidth: 420, textAlign: 'center', alignItems: 'center' }}>
        <PhysioLogo size={48} />
        <div className="stack stack--sm">
          <h1 style={{ fontSize: 26 }}>Welcome to PhysioAlign</h1>
          <p className="page-subtitle">
            Set up your profile so sessions can be scored against the right ranges and your reports stay relevant to your goal.
          </p>
        </div>
        <button className="btn btn--primary btn--lg" onClick={() => store.setScreen('onboarding')}>
          Get started
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
