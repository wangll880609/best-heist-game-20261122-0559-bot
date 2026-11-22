// The Velvet Vault — every tuning number, colour and level map in one place.
// The playfield is a fixed 1280x800 logical area (32x20 tiles of 40px); the
// renderer scales it to the window, so no rule below depends on screen size.

export const FIELD = { width: 1280, height: 800 };
export const TILE = 40;
export const COLS = 32;
export const ROWS = 20;

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walk: 175,
  sprint: 285,
  // Noise rings, in pixels: walking is quiet, sprinting and cracking a case are loud.
  walkNoise: 46,
  sprintNoise: 150,
  crackNoise: 210,
  crackSeconds: 1.4,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 62,
  investigateSpeed: 105,
  chaseSpeed: 168,
  viewRange: 235,
  viewHalfAngle: 0.56, // ~32 degrees each side
  // Detection fills 0..1 while the thief is in the cone; closer fills faster.
  detectPerSecond: 0.85,
  detectCloseBonus: 0.9,
  suspiciousAt: 0.45,
  // A guard that loses the thief searches the last seen spot, then goes back.
  searchSeconds: 4,
  catchDistance: 26,
};

export const CAMERA = {
  range: 265,
  halfAngle: 0.44, // ~25 degrees each side
  sweepSpeed: 0.55, // radians per second of the sweep centre
  alarmPerSecond: 34,
  empSeconds: 8,
};

export const ALARM = {
  decayPerSecond: 6,
  guardSeenPerSecond: 20,
  chaseBonus: 26,
  lockdownSeconds: 10,
  afterLockdown: 55,
  caughtReset: 40,
};

export const TOOLS = {
  smoke: { start: 3, cost: 100, radius: 135, seconds: 4 },
  emp: { start: 2, cost: 200, seconds: 8 },
};

export const LOOT_VALUE = { purse: 25, gold: 75, painting: 150, diamond: 500 };

export const LIVES = 3;

export const PALETTE = {
  floorA: '#20242e',
  floorB: '#252a36',
  floorTrim: '#3a4152',
  wall: '#12141c',
  wallEdge: '#c9a227',
  desk: '#4a3421',
  deskTop: '#5d4229',
  planter: '#1e4d2b',
  planterLeaf: '#2f7a44',
  rope: '#8e1f2f',
  ropePost: '#c9a227',
  carpet: '#3d1f2b',
  guard: '#2b3a67',
  guardCap: '#1c2745',
  guardCone: 'rgba(242, 201, 76, 0.20)',
  guardConeHot: 'rgba(229, 83, 75, 0.30)',
  camera: '#5a6274',
  cameraCone: 'rgba(229, 83, 75, 0.16)',
  player: '#7a5cff',
  playerCloak: '#4b2fb8',
  gold: '#f2c94c',
  diamond: '#7fe7f2',
  painting: '#c9a227',
  exit: '#2fbf71',
  text: '#eef1f5',
  muted: '#9aa3b5',
  alarmLow: '#2fbf71',
  alarmMid: '#f2c94c',
  alarmHigh: '#e5534b',
  panel: 'rgba(10, 12, 18, 0.82)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'velvet-vault.best';

// Map legend:
//   # wall   . floor   D desk (solid cover)   P planter (solid cover)
//   V velvet rope (walk-through, decorative)  C carpet (walk-through)
//   S player start   X exit / getaway   L purse   G gold bar   A painting
//   K locked display case (crack with F)   * the Crown Diamond
// Guards and cameras are placed in each level's `guards` / `cameras` lists
// (pixel waypoints), not in the map, so patrols stay readable.
export const LEVELS = [
  {
    name: 'Floor 1 — The Gallery',
    goal: 200,
    intro: 'Steal $200 of art, then slip out the service door.',
    map: [
      '################################',
      '#......D.......P.......D.......#',
      '#.S....D.......P.......D....L..#',
      '#......D.......P.......D.......#',
      '#......D.......P.......D.......#',
      '#..P...........P..........P....#',
      '#......#####...........#####...#',
      '#......#...#...........#...#...#',
      '#..L...#...#.....A.....#...#.L.#',
      '#......#...#...........#...#...#',
      '#......#####...........#####...#',
      '#..P...........P..........P....#',
      '#......D.......P.......D.......#',
      '#.L....D.......P.......D....A..#',
      '#......D.......P.......D.......#',
      '#......D.......P.......D.......#',
      '#..P...........P..........P....#',
      '#..............................#',
      '#......X.......................#',
      '################################',
    ],
    guards: [
      { waypoints: [[200, 240], [1080, 240]], pause: 1.2 },
      { waypoints: [[1080, 560], [200, 560]], pause: 1.2 },
    ],
    cameras: [
      { x: 640, y: 60, baseAngle: Math.PI / 2, sweep: 0.9 },
      { x: 1240, y: 400, baseAngle: Math.PI, sweep: 0.7 },
    ],
  },
  {
    name: 'Floor 2 — The Vault Hall',
    goal: 350,
    intro: 'Crack the locked cases. The vault guards walk faster here.',
    map: [
      '################################',
      '#..D......P......D......P......#',
      '#..D..S...P......D......P...L..#',
      '#..D......P......D......P......#',
      '#..D......P......D......P......#',
      '#......K...........K...........#',
      '#..P.......#####.......#####...#',
      '#.........#.....#.....#.....#..#',
      '#..G......#..K..#..A..#..K..#..#',
      '#.........#.....#.....#.....#..#',
      '#..P.......#####.......#####...#',
      '#......K...........K...........#',
      '#..D......P......D......P......#',
      '#..D......P......D......P...L..#',
      '#..D......P......D......P......#',
      '#..D......P......D......P......#',
      '#..P...........P..........P....#',
      '#..............................#',
      '#......X.......................#',
      '################################',
    ],
    guards: [
      { waypoints: [[160, 200], [1120, 200]], pause: 0.8 },
      { waypoints: [[1120, 420], [160, 420]], pause: 0.8 },
      { waypoints: [[640, 640], [640, 120]], pause: 0.6 },
    ],
    cameras: [
      { x: 40, y: 400, baseAngle: 0, sweep: 0.8 },
      { x: 640, y: 60, baseAngle: Math.PI / 2, sweep: 1.0 },
      { x: 1240, y: 700, baseAngle: -Math.PI / 2, sweep: 0.8 },
    ],
  },
  {
    name: 'Floor 3 — The Rooftop',
    goal: 500,
    intro: 'Take the Crown Diamond and reach the getaway van.',
    map: [
      '################################',
      '#..P......D.......D......P.....#',
      '#..P..S...D.......D......P..L..#',
      '#..P......D.......D......P.....#',
      '#..P......D.......D......P.....#',
      '#.........D.......D............#',
      '#..D...........*...........D...#',
      '#..D......P.........P......D...#',
      '#..D......P....A....P......D...#',
      '#..D......P.........P......D...#',
      '#..D...........P...........D...#',
      '#.........P.........P..........#',
      '#..P......D.......D......P.....#',
      '#..P..L...D.......D......P..G..#',
      '#..P......D.......D......P.....#',
      '#..P......D.......D......P.....#',
      '#..D...........P...........D...#',
      '#..............................#',
      '#......................X.......#',
      '################################',
    ],
    guards: [
      { waypoints: [[200, 160], [1080, 160]], pause: 0.7 },
      { waypoints: [[1080, 420], [200, 420]], pause: 0.7 },
      { waypoints: [[640, 700], [640, 100]], pause: 0.5 },
    ],
    cameras: [
      { x: 640, y: 60, baseAngle: Math.PI / 2, sweep: 1.1 },
      { x: 40, y: 640, baseAngle: 0, sweep: 0.9 },
    ],
  },
];
