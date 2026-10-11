import { ArrowRight } from 'lucide-react';
import { store } from '../game/store';
import { POSES } from '../data/poses';
import { TopBar } from './primitives';

const DIFFICULTY_CLASS: Record<string, string> = {
  Easy: 'badge--success',
  Medium: 'badge--warn',
  Hard: 'badge--danger',
};

export function PoseLibraryScreen() {
  return (
    <div className="screen">
      <TopBar here={1} steps={['Dashboard', 'Pose library']} />

      <div className="page">
        <div className="container container--wide">
          <div className="page-header">
            <div className="page-header__text">
              <h1>Pose library</h1>
              <p className="page-subtitle">
                Pick a pose to start a tracked session. Each one lists the joints that are scored and the range you're aiming for.
              </p>
            </div>
          </div>

          <div className="grid grid--auto">
            {POSES.map((pose) => {
              const targets = Object.values(pose.targetAngles);
              return (
                <article key={pose.id} className="card card--raised" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: 12 }}>
                    <div
                      style={{
                        background: 'var(--surface-sunken)',
                        borderRadius: 'var(--r-sm)',
                        height: 168,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      <img src={pose.image} alt={pose.name} style={{ height: '100%', width: '100%', objectFit: 'contain' }} />
                    </div>
                  </div>

                  <div className="card__body stack stack--sm" style={{ paddingTop: 4, flex: 1 }}>
                    <div className="row spread">
                      <h3>{pose.name}</h3>
                      <span className={`badge ${DIFFICULTY_CLASS[pose.difficulty] || ''}`}>{pose.difficulty}</span>
                    </div>
                    <p className="text-sm secondary">{pose.description}</p>

                    <div className="stack stack--sm" style={{ marginTop: 4 }}>
                      <span className="overline">Scored joints</span>
                      <ul className="stack stack--sm text-sm secondary" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                        {targets.slice(0, 3).map((target, idx) => (
                          <li key={idx} className="row spread">
                            <span>{target!.label}</span>
                            <span className="numeric muted">
                              {target!.min}°–{target!.max}°
                            </span>
                          </li>
                        ))}
                        {targets.length > 3 && <li className="muted text-xs">+{targets.length - 3} more</li>}
                      </ul>
                    </div>
                  </div>

                  <div className="card__footer">
                    <button className="btn btn--primary btn--block" onClick={() => store.selectPose(pose.id)}>
                      Start session
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
