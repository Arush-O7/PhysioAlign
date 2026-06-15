import { PoseConfig } from '../game/types';

export const POSES: PoseConfig[] = [
  {
    id: 'tree-pose',
    name: 'Tree Pose (Vrikshasana)',
    description: 'A foundational standing balance pose that builds focus, stability, and leg strength.',
    difficulty: 'Easy',
    targetMuscles: ['Ankles', 'Calves', 'Thighs', 'Core'],
    instructions: [
      'Stand tall with feet hip-width apart (Tadasana).',
      'Shift your weight onto your left foot, keeping the leg strong and straight.',
      'Bend your right knee, turning it outward, and place the sole of your right foot against the inner left thigh (or calf, but avoid the knee).',
      'Bring your hands to your chest in prayer position (Anjali Mudra) or stretch them straight overhead.',
      'Hold your balance, keeping your gaze fixed on a single point in front of you.'
    ],
    commonMistakes: [
      'Placing the foot directly on the knee joint (causes knee strain).',
      'Letting the standing hip jut out to the side.',
      'Leaning forward or bending the standing knee.'
    ],
    visibilityRequirements: ['LEFT_KNEE', 'RIGHT_KNEE', 'LEFT_HIP', 'RIGHT_HIP', 'LEFT_SHOULDER', 'RIGHT_SHOULDER'],
    targetAngles: {
      leftKnee: { min: 165, max: 180, optimal: 175, label: 'Standing Leg (Knee)' },
      rightKnee: { min: 35, max: 80, optimal: 55, label: 'Bent Leg (Knee)' },
      leftShoulder: { min: 145, max: 180, optimal: 170, label: 'Shoulder Extension' },
      rightShoulder: { min: 145, max: 180, optimal: 170, label: 'Shoulder Extension' }
    },
    image: '/poses/tree-pose.png'
  },
  {
    id: 'warrior-ii',
    name: 'Warrior II (Virabhadrasana II)',
    description: 'A powerful standing pose that stretches the hips, chest, and shoulders while strengthening the legs.',
    difficulty: 'Medium',
    targetMuscles: ['Quadriceps', 'Glutes', 'Shoulders', 'Chest'],
    instructions: [
      'Stand with feet wide apart (about 3.5 to 4 feet).',
      'Turn your right foot out 90 degrees and your left foot slightly inward.',
      'Raise your arms parallel to the floor, reaching out actively to the sides, palms down.',
      'Bend your right knee over the right ankle, so the shin is perpendicular to the floor.',
      'Keep your torso upright and look out over your right fingertips.'
    ],
    commonMistakes: [
      'Letting the front knee cave inward past the big toe.',
      'Leaning the torso forward toward the front knee instead of staying centered.',
      'Dropping the back arm below shoulder height.'
    ],
    visibilityRequirements: ['LEFT_KNEE', 'RIGHT_KNEE', 'LEFT_HIP', 'RIGHT_HIP', 'LEFT_SHOULDER', 'RIGHT_SHOULDER', 'LEFT_ELBOW', 'RIGHT_ELBOW'],
    targetAngles: {
      rightKnee: { min: 80, max: 110, optimal: 95, label: 'Front Knee Bend' },
      leftKnee: { min: 165, max: 180, optimal: 175, label: 'Back Leg Knee' },
      rightShoulder: { min: 80, max: 105, optimal: 90, label: 'Front Arm Shoulder' },
      leftShoulder: { min: 80, max: 105, optimal: 90, label: 'Back Arm Shoulder' },
      rightElbow: { min: 160, max: 180, optimal: 175, label: 'Front Arm Extension' },
      leftElbow: { min: 160, max: 180, optimal: 175, label: 'Back Arm Extension' }
    },
    image: '/poses/warrior-ii.png'
  },
  {
    id: 'downward-dog',
    name: 'Downward-Facing Dog (Adho Mukha Svanasana)',
    description: 'An inverted V-pose that stretches the hamstrings, calves, and spine while building upper body strength.',
    difficulty: 'Medium',
    targetMuscles: ['Hamstrings', 'Calves', 'Shoulders', 'Lats', 'Wrists'],
    instructions: [
      'Start on your hands and knees, with wrists directly under shoulders and knees under hips.',
      'Tuck your toes, press down through your palms, and lift your knees off the floor.',
      'Extend your hips up and back, lengthening your spine to form an inverted "V" shape.',
      'Straighten your legs as much as possible, pressing heels toward the floor.',
      'Keep your head relaxed between your arms, looking back toward your feet.'
    ],
    commonMistakes: [
      'Rounding the lower back (bend knees slightly to prioritize spine length instead).',
      'Shrugging shoulders toward ears (rotate shoulders outward to create neck space).',
      'Bending the elbows.'
    ],
    visibilityRequirements: ['LEFT_KNEE', 'RIGHT_KNEE', 'LEFT_HIP', 'RIGHT_HIP', 'LEFT_SHOULDER', 'RIGHT_SHOULDER', 'LEFT_ELBOW', 'RIGHT_ELBOW'],
    targetAngles: {
      leftHip: { min: 65, max: 95, optimal: 80, label: 'Hip Flexion' },
      rightHip: { min: 65, max: 95, optimal: 80, label: 'Hip Flexion' },
      leftKnee: { min: 160, max: 180, optimal: 175, label: 'Knee Extension' },
      rightKnee: { min: 160, max: 180, optimal: 175, label: 'Knee Extension' },
      leftElbow: { min: 165, max: 180, optimal: 175, label: 'Left Arm Extension' },
      rightElbow: { min: 165, max: 180, optimal: 175, label: 'Right Arm Extension' }
    },
    image: '/poses/downward-dog.png'
  },
  {
    id: 'cobra-pose',
    name: 'Cobra Pose (Bhujangasana)',
    description: 'A gentle backbend that opens the chest, strengthens the spine, and stretches the abdomen.',
    difficulty: 'Easy',
    targetMuscles: ['Lower Back', 'Glutes', 'Chest', 'Triceps'],
    instructions: [
      'Lie face down on the floor with your legs extended behind you, tops of feet flat on the floor.',
      'Place your hands flat on the floor under your shoulders, hugging elbows close to your torso.',
      'Press down through your feet and pubic bone, inhale, and lift your chest off the floor.',
      'Keep your elbows slightly bent and shoulders rolled back away from your ears.',
      'Keep your neck neutral, gazing gently forward or upward.'
    ],
    commonMistakes: [
      'Pushing up too high and locking elbows (strains the lower back).',
      'Shrugging shoulders up to ears.',
      'Lifting the hips or legs off the floor.'
    ],
    visibilityRequirements: ['LEFT_HIP', 'RIGHT_HIP', 'LEFT_SHOULDER', 'RIGHT_SHOULDER', 'LEFT_ELBOW', 'RIGHT_ELBOW'],
    targetAngles: {
      leftHip: { min: 145, max: 180, optimal: 165, label: 'Hip Extension' },
      rightHip: { min: 145, max: 180, optimal: 165, label: 'Hip Extension' },
      leftElbow: { min: 110, max: 145, optimal: 130, label: 'Left Elbow Bend' },
      rightElbow: { min: 110, max: 145, optimal: 130, label: 'Right Elbow Bend' },
      leftShoulder: { min: 35, max: 75, optimal: 55, label: 'Chest Opening' },
      rightShoulder: { min: 35, max: 75, optimal: 55, label: 'Chest Opening' }
    },
    image: '/poses/cobra-pose.png'
  },
  {
    id: 'chair-pose',
    name: 'Chair Pose (Utkatasana)',
    description: 'A powerful standing posture that strengthens the lower body, improves posture, and builds endurance.',
    difficulty: 'Medium',
    targetMuscles: ['Thighs', 'Glutes', 'Core', 'Shoulders'],
    instructions: [
      'Stand with feet together or hip-width apart.',
      'Inhale and raise your arms overhead, palms facing each other, keeping shoulders relaxed.',
      'Exhale and bend your knees, shifting your hips back and down as if sitting in an imaginary chair.',
      'Keep your weight in your heels and your chest lifted; do not let your knees extend past your toes.',
      'Hold the pose, keeping your breathing steady and deep.'
    ],
    commonMistakes: [
      'Letting the knees slide too far forward past the toes (strains knees).',
      'Arching the lower back excessively instead of tucking the tailbone slightly.',
      'Letting the chest collapse forward.'
    ],
    visibilityRequirements: ['LEFT_KNEE', 'RIGHT_KNEE', 'LEFT_HIP', 'RIGHT_HIP', 'LEFT_SHOULDER', 'RIGHT_SHOULDER'],
    targetAngles: {
      leftKnee: { min: 90, max: 125, optimal: 105, label: 'Left Knee Bend' },
      rightKnee: { min: 90, max: 125, optimal: 105, label: 'Right Knee Bend' },
      leftHip: { min: 95, max: 130, optimal: 110, label: 'Left Hip Flexion' },
      rightHip: { min: 95, max: 130, optimal: 110, label: 'Right Hip Flexion' },
      leftShoulder: { min: 135, max: 180, optimal: 160, label: 'Left Arm Reach' },
      rightShoulder: { min: 135, max: 180, optimal: 160, label: 'Right Arm Reach' }
    },
    image: '/poses/chair-pose.png'
  },
  {
    id: 'plank-pose',
    name: 'Plank Pose (Phalakasana)',
    description: 'A core-strengthening posture that tones the abdominals, refines balance, and builds upper body power.',
    difficulty: 'Medium',
    targetMuscles: ['Core', 'Shoulders', 'Arms', 'Quadriceps'],
    instructions: [
      'Start on your hands and knees, with wrists directly under shoulders.',
      'Step your feet back one at a time, extending your legs straight behind you.',
      'Press through your hands, drawing your chest forward and tucking your tailbone.',
      'Create a straight line from your heels to the crown of your head; do not sag your hips.',
      'Engage your thighs and push your heels back actively.'
    ],
    commonMistakes: [
      'Sagging the hips toward the floor (strains the lower back).',
      'Piking the hips up too high, which shifts weight off the core.',
      'Locking or hyperextending the elbows.'
    ],
    visibilityRequirements: ['LEFT_KNEE', 'RIGHT_KNEE', 'LEFT_HIP', 'RIGHT_HIP', 'LEFT_SHOULDER', 'RIGHT_SHOULDER', 'LEFT_ELBOW', 'RIGHT_ELBOW'],
    targetAngles: {
      leftKnee: { min: 165, max: 180, optimal: 175, label: 'Left Knee Line' },
      rightKnee: { min: 165, max: 180, optimal: 175, label: 'Right Knee Line' },
      leftHip: { min: 165, max: 180, optimal: 175, label: 'Left Hip Line' },
      rightHip: { min: 165, max: 180, optimal: 175, label: 'Right Hip Line' },
      leftElbow: { min: 165, max: 180, optimal: 175, label: 'Left Elbow Extension' },
      rightElbow: { min: 165, max: 180, optimal: 175, label: 'Right Elbow Extension' }
    },
    image: '/poses/plank-pose.png'
  },
  {
    id: 'warrior-i',
    name: 'Warrior I (Virabhadrasana I)',
    description: 'A standing posture representing power and focus, stretching the hips and chest while strengthening the lower body.',
    difficulty: 'Medium',
    targetMuscles: ['Quadriceps', 'Glutes', 'Calves', 'Shoulders'],
    instructions: [
      'From a standing position, step your left foot back about 3 to 4 feet.',
      'Turn your left foot out 45 degrees, pressing the outer edge firmly into the floor.',
      'Bend your right knee so it is stacked directly over your right ankle (front thigh parallel to floor).',
      'Inhale and reach your arms straight overhead, opening your chest.',
      'Square your hips as much as possible toward the front of your mat.'
    ],
    commonMistakes: [
      'Allowing the front knee to cave inward or drift forward past the ankle.',
      'Lifting the back heel off the floor.',
      'Arching the lower back excessively; keep core engaged and pelvis tucked.'
    ],
    visibilityRequirements: ['LEFT_KNEE', 'RIGHT_KNEE', 'LEFT_HIP', 'RIGHT_HIP', 'LEFT_SHOULDER', 'RIGHT_SHOULDER'],
    targetAngles: {
      rightKnee: { min: 85, max: 115, optimal: 100, label: 'Front Knee Bend' },
      leftKnee: { min: 165, max: 180, optimal: 175, label: 'Back Leg Knee' },
      leftShoulder: { min: 140, max: 180, optimal: 165, label: 'Left Arm Reach' },
      rightShoulder: { min: 140, max: 180, optimal: 165, label: 'Right Arm Reach' }
    },
    image: '/poses/warrior-i.png'
  },
  {
    id: 'bridge-pose',
    name: 'Bridge Pose (Setu Bandha Sarvangasana)',
    description: 'A restorative backbend that opens the chest, stretches the spine, and strengthens the glutes and thighs.',
    difficulty: 'Easy',
    targetMuscles: ['Glutes', 'Hamstrings', 'Lower Back', 'Core'],
    instructions: [
      'Lie on your back with your knees bent and feet flat on the floor, hip-width apart.',
      'Extend your arms along the floor, palms facing down, fingertips grazing your heels.',
      'Exhale and press your feet and arms into the floor, lifting your hips toward the ceiling.',
      'Keep your thighs and feet parallel; do not let your knees splay outward.',
      'Clasp your hands under your pelvis if comfortable, rolling your shoulders closer together.'
    ],
    commonMistakes: [
      'Allowing the knees to splay outward (keep thighs active and parallel).',
      'Squeezing the glutes too tightly, which can pinch the lower back.',
      'Turning the neck or head side-to-side while in the pose.'
    ],
    visibilityRequirements: ['LEFT_KNEE', 'RIGHT_KNEE', 'LEFT_HIP', 'RIGHT_HIP'],
    targetAngles: {
      leftKnee: { min: 70, max: 95, optimal: 85, label: 'Left Knee Bend' },
      rightKnee: { min: 70, max: 95, optimal: 85, label: 'Right Knee Bend' },
      leftHip: { min: 135, max: 165, optimal: 150, label: 'Left Hip Extension' },
      rightHip: { min: 135, max: 165, optimal: 150, label: 'Right Hip Extension' }
    },
    image: '/poses/bridge-pose.png'
  },
  {
    id: 'triangle-pose',
    name: 'Triangle Pose (Trikonasana)',
    description: 'A core standing posture that stretches the legs, chest, and shoulders while improving hip mobility.',
    difficulty: 'Medium',
    targetMuscles: ['Hamstrings', 'Hips', 'Obliques', 'Shoulders'],
    instructions: [
      'Stand with feet wide apart (about 3.5 to 4 feet).',
      'Turn your right foot out 90 degrees and your left foot slightly inward.',
      'Raise your arms parallel to the floor, reaching out actively to the sides.',
      'Reach your torso forward over your right leg, then hinge from the hip, bringing your right hand down to your shin, ankle, or floor.',
      'Extend your left arm straight up toward the ceiling, looking up at your left hand if comfortable.'
    ],
    commonMistakes: [
      'Collapsing the chest forward (keep your chest open and stacked over your front leg).',
      'Bending the front knee (both legs should be straight and active).',
      'Leaning too far forward, dropping weight onto the bottom arm.'
    ],
    visibilityRequirements: ['LEFT_KNEE', 'RIGHT_KNEE', 'LEFT_HIP', 'RIGHT_HIP', 'LEFT_SHOULDER', 'RIGHT_SHOULDER', 'LEFT_ELBOW', 'RIGHT_ELBOW'],
    targetAngles: {
      leftKnee: { min: 165, max: 180, optimal: 175, label: 'Left Knee Extension' },
      rightKnee: { min: 165, max: 180, optimal: 175, label: 'Right Knee Extension' },
      leftShoulder: { min: 80, max: 110, optimal: 90, label: 'Left Arm Line' },
      rightShoulder: { min: 80, max: 110, optimal: 90, label: 'Right Arm Line' },
      leftElbow: { min: 165, max: 180, optimal: 175, label: 'Left Arm Straight' },
      rightElbow: { min: 165, max: 180, optimal: 175, label: 'Right Arm Straight' }
    },
    image: '/poses/triangle-pose.png'
  }
];

export const getPoseById = (id: string): PoseConfig | undefined => {
  return POSES.find(p => p.id === id);
};

export interface PoseFeedback {
  score: number;
  corrections: string[];
  feedback: string;
  severity: 'success' | 'warning' | 'error';
  jointDeviations: Record<string, { current: number; ideal: string; error: boolean }>;
}

/**
 * Compare measured angles against target angles for a given pose
 */
export const evaluatePose = (poseId: string, angles: Record<string, number>): PoseFeedback => {
  const pose = getPoseById(poseId);
  if (!pose) {
    return {
      score: 0,
      corrections: [],
      feedback: 'Pose not found',
      severity: 'error',
      jointDeviations: {}
    };
  }

  let totalScore = 100;
  const corrections: string[] = [];
  const jointDeviations: Record<string, { current: number; ideal: string; error: boolean }> = {};
  let criticalErrorsCount = 0;
  let minorErrorsCount = 0;

  // Symmetrical check for Tree Pose because left/right standing leg depends on user choice
  if (poseId === 'tree-pose') {
    // Determine which leg is standing vs bent.
    // The standing knee is close to 180 (extended), the bent knee is bent (< 100).
    const leftK = angles.leftKnee || 180;
    const rightK = angles.rightKnee || 180;
    
    const isLeftStanding = Math.abs(leftK - 180) < Math.abs(rightK - 180);
    
    const standingKnee = isLeftStanding ? leftK : rightK;
    const standingKneeName = isLeftStanding ? 'leftKnee' : 'rightKnee';
    const standingKneeLabel = isLeftStanding ? 'Left Knee (Standing)' : 'Right Knee (Standing)';
    
    const bentKnee = isLeftStanding ? rightK : leftK;
    const bentKneeName = isLeftStanding ? 'rightKnee' : 'leftKnee';
    const bentKneeLabel = isLeftStanding ? 'Right Knee (Bent)' : 'Left Knee (Bent)';

    // Standing knee evaluation (Ideal: 165 - 180)
    const standingDev = Math.max(0, 165 - standingKnee, standingKnee - 180);
    jointDeviations[standingKneeName] = { current: standingKnee, ideal: '165° - 180°', error: standingDev > 5 };
    if (standingDev > 5) {
      totalScore -= 20;
      criticalErrorsCount++;
      corrections.push(`${standingKneeLabel}: Straighten your standing leg knee.`);
    }

    // Bent knee evaluation (Ideal: 35 - 80)
    const bentDev = Math.max(0, 35 - bentKnee, bentKnee - 80);
    jointDeviations[bentKneeName] = { current: bentKnee, ideal: '35° - 80°', error: bentDev > 10 };
    if (bentDev > 10) {
      totalScore -= 20;
      criticalErrorsCount++;
      corrections.push(`${bentKneeLabel}: Place your foot higher on the inner thigh or lower on the calf.`);
    }

    // Shoulders (Ideal: 145 - 180)
    const leftS = angles.leftShoulder || 0;
    const rightS = angles.rightShoulder || 0;
    const leftSDev = Math.max(0, 145 - leftS, leftS - 180);
    const rightSDev = Math.max(0, 145 - rightS, rightS - 180);
    
    jointDeviations.leftShoulder = { current: leftS, ideal: '145° - 180°', error: leftSDev > 10 };
    jointDeviations.rightShoulder = { current: rightS, ideal: '145° - 180°', error: rightSDev > 10 };

    if (leftSDev > 10 || rightSDev > 10) {
      totalScore -= 15;
      minorErrorsCount++;
      corrections.push('Shoulders: Reach your arms higher overhead, keeping them long.');
    }
  } else {
    // Standard linear pose evaluation
    for (const [joint, target] of Object.entries(pose.targetAngles)) {
      const current = angles[joint];
      if (current === undefined) continue;

      const dev = Math.max(0, target.min - current, current - target.max);
      const isErr = dev > 10;
      jointDeviations[joint] = { current, ideal: `${target.min}° - ${target.max}°`, error: isErr };

      if (isErr) {
        if (dev > 25) {
          totalScore -= 20;
          criticalErrorsCount++;
          corrections.push(`${target.label}: Major deviation! Current: ${current}°, should be ${target.min}° - ${target.max}°.`);
        } else {
          totalScore -= 10;
          minorErrorsCount++;
          corrections.push(`${target.label}: Adjust slightly. Current: ${current}°, ideal: ${target.min}° - ${target.max}°.`);
        }
      }
    }
  }

  // Ensure score doesn't drop below 0
  const score = Math.max(0, totalScore);

  // Determine overall feedback and severity
  let feedback = 'Perfect form! Keep breathing and hold this pose.';
  let severity: 'success' | 'warning' | 'error' = 'success';

  if (criticalErrorsCount > 0) {
    feedback = 'Inaccurate pose! Adjust your joints according to the cues.';
    severity = 'error';
  } else if (minorErrorsCount > 0) {
    feedback = 'Almost there! Make slight posture adjustments.';
    severity = 'warning';
  }

  return {
    score,
    corrections,
    feedback,
    severity,
    jointDeviations
  };
};
