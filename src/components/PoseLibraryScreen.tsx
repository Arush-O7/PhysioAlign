import { store } from '../game/store';
import { POSES } from '../data/poses';
import { TopBar } from './primitives';
import { Sparkles, Trophy } from 'lucide-react';

export function PoseLibraryScreen() {
  const handleSelectPose = (id: string) => {
    store.selectPose(id);
  };

  return (
    <div className="screen" style={{ background: 'var(--cream)' }}>
      <TopBar here={1} steps={['Dashboard', 'Select Pose']} />

      <main style={{ maxWidth: 1024, margin: '24px auto', padding: '0 24px' }}>
        
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 28 }} className="popin">
          <h1 style={{ fontSize: 34, color: 'var(--ink)' }}>Choose your Pose</h1>
          <p style={{ fontSize: 16, color: 'var(--ink-2)', fontWeight: 700, marginTop: 4 }}>
            Select a pose to begin real-time posture analysis. Maintain the targets to trigger hold timers.
          </p>
        </div>

        {/* Library Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
          {POSES.map((pose) => (
            <div
              key={pose.id}
              className="plush tap"
              onClick={() => handleSelectPose(pose.id)}
              style={{
                background: 'white',
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 16,
                minHeight: 320,
                cursor: 'pointer'
              }}
            >
              <div>
                {/* Header line */}
                <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <span className={`chip ${pose.difficulty === 'Easy' ? 'mint' : pose.difficulty === 'Medium' ? 'butter' : 'rose'}`}>
                    {pose.difficulty}
                  </span>
                  
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-soft)' }} className="chip">
                    <Sparkles size={12} style={{ marginRight: 3 }} /> {pose.targetMuscles[0]} + {pose.targetMuscles.length - 1} more
                  </span>
                </div>

                {/* Pose Image */}
                <div style={{
                  marginTop: 14,
                  overflow: 'hidden',
                  borderRadius: 12,
                  border: '3.5px solid var(--ink)',
                  boxShadow: '4px 4px 0px var(--ink)',
                  background: 'var(--cream)',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: 160
                }}>
                  <img
                    src={pose.image}
                    alt={pose.name}
                    style={{
                      height: '100%',
                      width: '100%',
                      objectFit: 'contain',
                      display: 'block'
                    }}
                  />
                </div>

                {/* Pose title */}
                <h3 style={{ fontSize: 21, fontWeight: 900, color: 'var(--ink)', marginTop: 16 }}>
                  {pose.name}
                </h3>
                
                {/* Description */}
                <p style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 8, lineHeight: 1.4, fontWeight: 600 }}>
                  {pose.description}
                </p>

                {/* Anatomy targets */}
                <div style={{ marginTop: 14 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Alignment Targets
                  </span>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 13, color: 'var(--ink)', fontWeight: 700 }}>
                    {Object.values(pose.targetAngles).map((ang, i) => (
                      <li key={i} style={{ marginBottom: 4 }}>
                        {ang.label}: <span style={{ color: 'var(--peach-deep)' }}>{ang.min}° - {ang.max}°</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Select Button */}
              <button
                className="btn-plush primary"
                style={{ width: '100%', padding: '10px' }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectPose(pose.id);
                }}
              >
                <Trophy size={16} /> Start Calibration
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
