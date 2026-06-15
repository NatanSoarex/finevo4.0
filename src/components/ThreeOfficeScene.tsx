import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";

// Solid office obstacles metadata for collision checking
const OBSTACLES = [
  { x: -3.95, z: 3.55, r: 0.8 },      // SW Desk
  { x: -2.75, z: 3.55, r: 0.8 },      // SE Desk
  { x: -3.95, z: 2.95, r: 0.8 },      // NW Desk
  { x: -2.75, z: 2.95, r: 0.8 },      // NE Desk
  { x: 0.0, z: -3.2, r: 1.2 },       // CDB Pool
  { x: -3.8, z: -1.0, r: 0.70 },      // Sofa West (Large group)
  { x: -2.4, z: -2.4, r: 0.70 },      // Sofa North (Large group)
  { x: -2.4, z: 0.4, r: 0.70 },       // Sofa South (Large group)
  { x: -1.1, z: -1.0, r: 0.55 },      // Gaming Station (TV Stand)
  { x: -3.2, z: -4.6, r: 1.6 },      // Kitchen unit (Fridge + Counter + Cooler) against back wall
  { x: 3.6, z: -3.6, r: 1.1 },       // Mini Piscina (Back Right)
];

// Navigational corridors used as fallback pivots when the direct path would cross an obstacle
const WAYPOINTS: [number, number][] = [
  [0, 0.2],       // Center space (highly safe transit point)
  [-1.5, 0.4],    // Left path corridor
  [1.5, 0.4],     // Right path corridor
  [0, 1.8],       // Front computers passageway
  [0, -1.3],      // Back asset crossway
  [-3.0, 0.5],    // Mid-left corridor
  [3.0, 0.5],     // Mid-right corridor
  [-1.8, -2.5],   // Walkway near kitchen / dispenser zone
  
  // Safe approaches for our 4-desk island
  [-3.35, 1.8],   // Safe approach North of the island (for chairs of NW, NE)
  [-3.35, 4.5],   // Safe approach South of the island (for chairs of SW, SE)
  [-1.6, 3.2],    // Safe East passageway
  [2.4, -2.4],    // Walkway near mini pool area
];

// Active workstations definition
const DESKS_CONFIG = [
  { deskX: -3.95, deskZ: 3.55, chairX: -3.95, chairZ: 4.07, rotation: 0 },
  { deskX: -2.75, deskZ: 3.55, chairX: -2.75, chairZ: 4.07, rotation: 0 },
  { deskX: -3.95, deskZ: 2.95, chairX: -3.95, chairZ: 2.43, rotation: Math.PI },
  { deskX: -2.75, deskZ: 2.95, chairX: -2.75, chairZ: 2.43, rotation: Math.PI },
];

// Detects the obstacle associated with the target destination so we don't block the final approach
function getIgnoredObstacleForTarget(targetX: number, targetZ: number) {
  // Desk SW (desk_0)
  if (Math.abs(targetX - -3.95) < 0.45 && Math.abs(targetZ - 4.07) < 0.45) {
    return { x: -3.95, z: 3.55 };
  }
  // Desk SE (desk_1)
  if (Math.abs(targetX - -2.75) < 0.45 && Math.abs(targetZ - 4.07) < 0.45) {
    return { x: -2.75, z: 3.55 };
  }
  // Desk NW (desk_2)
  if (Math.abs(targetX - -3.95) < 0.45 && Math.abs(targetZ - 2.43) < 0.45) {
    return { x: -3.95, z: 2.95 };
  }
  // Desk NE (desk_3)
  if (Math.abs(targetX - -2.75) < 0.45 && Math.abs(targetZ - 2.43) < 0.45) {
    return { x: -2.75, z: 2.95 };
  }
  // Coffee Machine/Kitchen Counter
  if (Math.abs(targetX - -3.0) < 0.6 && Math.abs(targetZ - -3.9) < 0.6) {
    return { x: -3.2, z: -4.6 };
  }
  // Water Cooler
  if (Math.abs(targetX - -1.7) < 0.6 && Math.abs(targetZ - -3.9) < 0.6) {
    return { x: -3.2, z: -4.6 };
  }
  // Refrigerator (Geladeira) / Food station
  if (Math.abs(targetX - -4.3) < 0.6 && Math.abs(targetZ - -3.9) < 0.6) {
    return { x: -3.2, z: -4.6 };
  }
  // Mini Piscina
  if (Math.abs(targetX - 3.6) < 0.8 && Math.abs(targetZ - -3.6) < 0.8) {
    return { x: 3.6, z: -3.6 };
  }
  // Sofa West seats
  if (Math.abs(targetX - -3.5) < 0.5 && Math.abs(targetZ - -1.0) < 0.9) {
    return { x: -3.8, z: -1.0 };
  }
  // Sofa North seats
  if (Math.abs(targetX - -2.4) < 0.9 && Math.abs(targetZ - -2.1) < 0.5) {
    return { x: -2.4, z: -2.4 };
  }
  // Sofa South seats
  if (Math.abs(targetX - -2.4) < 0.9 && Math.abs(targetZ - 0.1) < 0.5) {
    return { x: -2.4, z: 0.4 };
  }
  return null;
}

// Helper to check line segment intersection
function lineSegmentsIntersect(
  p0_x: number, p0_y: number, p1_x: number, p1_y: number,
  p2_x: number, p2_y: number, p3_x: number, p3_y: number
): boolean {
  const s1_x = p1_x - p0_x;
  const s1_y = p1_y - p0_y;
  const s2_x = p3_x - p2_x;
  const s2_y = p3_y - p2_y;

  const denominator = -s2_x * s1_y + s1_x * s2_y;
  if (Math.abs(denominator) < 1e-8) return false;

  const s = (-s1_y * (p0_x - p2_x) + s1_x * (p0_y - p2_y)) / denominator;
  const t = ( s2_x * (p0_y - p2_y) - s2_y * (p0_x - p2_x)) / denominator;

  return s >= 0 && s <= 1 && t >= 0 && t <= 1;
}

// Helper to check if a segment intersects a 2D bounding box
function doesSegmentIntersectBox(
  x1: number, z1: number, x2: number, z2: number,
  minX: number, maxX: number, minZ: number, maxZ: number
): boolean {
  if (x1 >= minX && x1 <= maxX && z1 >= minZ && z1 <= maxZ) return true;
  if (x2 >= minX && x2 <= maxX && z2 >= minZ && z2 <= maxZ) return true;

  if (lineSegmentsIntersect(x1, z1, x2, z2, minX, minZ, maxX, minZ)) return true;
  if (lineSegmentsIntersect(x1, z1, x2, z2, maxX, minZ, maxX, maxZ)) return true;
  if (lineSegmentsIntersect(x1, z1, x2, z2, maxX, maxZ, minX, maxZ)) return true;
  if (lineSegmentsIntersect(x1, z1, x2, z2, minX, maxZ, minX, minZ)) return true;

  return false;
}

// Evaluates if a straight line segment collides with any solid obstacle's boundary
function doesSegmentCollide(
  x1: number, 
  z1: number, 
  x2: number, 
  z2: number, 
  ignoreObs1?: { x: number, z: number } | null,
  ignoreObs2?: { x: number, z: number } | null
) {
  // 1. Loop check for the 4 desks forming the quad cluster
  const ourDesks = [
    { x: -3.95, z: 3.55 }, // SW Desk
    { x: -2.75, z: 3.55 }, // SE Desk
    { x: -3.95, z: 2.95 }, // NW Desk
    { x: -2.75, z: 2.95 }, // NE Desk
  ];

  for (const dk of ourDesks) {
    const matchesObs1 = ignoreObs1 && Math.abs(dk.x - ignoreObs1.x) < 0.1 && Math.abs(dk.z - ignoreObs1.z) < 0.1;
    const matchesObs2 = ignoreObs2 && Math.abs(dk.x - ignoreObs2.x) < 0.1 && Math.abs(dk.z - ignoreObs2.z) < 0.1;

    let minX, maxX, minZ, maxZ;
    if (matchesObs1 || matchesObs2) {
      // Small core collision profile when agent approaches their own desk
      minX = dk.x - 0.2;
      maxX = dk.x + 0.2;
      minZ = dk.z - 0.15;
      maxZ = dk.z + 0.15;
    } else {
      // Full tabletop bounding box boundaries check with buffer
      minX = dk.x - 0.5 - 0.20;
      maxX = dk.x + 0.5 + 0.20;
      minZ = dk.z - 0.26 - 0.20;
      maxZ = dk.z + 0.26 + 0.20;
    }
    if (doesSegmentIntersectBox(x1, z1, x2, z2, minX, maxX, minZ, maxZ)) {
      return { x: dk.x, z: dk.z, r: 0.8 };
    }
  }

  // 4. Check circular obstacles
  for (const obs of OBSTACLES) {
    const isOurDesk = ourDesks.some((dk) => Math.abs(obs.x - dk.x) < 0.1 && Math.abs(obs.z - dk.z) < 0.1);
    if (isOurDesk) continue;

    let effectiveRadius = obs.r;

    const matchesObs1 = ignoreObs1 && Math.abs(obs.x - ignoreObs1.x) < 0.05 && Math.abs(obs.z - ignoreObs1.z) < 0.05;
    const matchesObs2 = ignoreObs2 && Math.abs(obs.x - ignoreObs2.x) < 0.05 && Math.abs(obs.z - ignoreObs2.z) < 0.05;
    if (matchesObs1 || matchesObs2) {
      effectiveRadius = 0.35;
    }

    const dx = x2 - x1;
    const dz = z2 - z1;
    const lenSq = dx * dx + dz * dz;
    if (lenSq === 0) continue;

    let t = ((obs.x - x1) * dx + (obs.z - z1) * dz) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const projX = x1 + t * dx;
    const projZ = z1 + t * dz;

    const distSq = (obs.x - projX) * (obs.x - projX) + (obs.z - projZ) * (obs.z - projZ);
    if (distSq < effectiveRadius * effectiveRadius) {
      return obs;
    }
  }
  return null;
}

// Stateful physical collision forcefield boundary resolver
function resolveRigidCollisions(
  proposedX: number,
  proposedZ: number,
  ignoreObs1?: { x: number, z: number } | null,
  ignoreObs2?: { x: number, z: number } | null
): { x: number, z: number } {
  let x = proposedX;
  let z = proposedZ;

  // 1. Resolve room wall bounds (11x11 floor layout, so limit to comfortable -5.1 to 5.1 buffer)
  x = Math.max(-5.1, Math.min(5.1, x));
  z = Math.max(-5.1, Math.min(5.1, z));

  // 2. Resolve box collisions for the 4 desks
  const ourDesks = [
    { x: -3.95, z: 3.55 }, // SW Desk
    { x: -2.75, z: 3.55 }, // SE Desk
    { x: -3.95, z: 2.95 }, // NW Desk
    { x: -2.75, z: 2.95 }, // NE Desk
  ];

  for (const dk of ourDesks) {
    const matchesObs1 = ignoreObs1 && Math.abs(dk.x - ignoreObs1.x) < 0.1 && Math.abs(dk.z - ignoreObs1.z) < 0.1;
    const matchesObs2 = ignoreObs2 && Math.abs(dk.x - ignoreObs2.x) < 0.1 && Math.abs(dk.z - ignoreObs2.z) < 0.1;

    let minX, maxX, minZ, maxZ;
    if (matchesObs1 || matchesObs2) {
      // Shrunk core profile to permit seat tucking
      minX = dk.x - 0.22;
      maxX = dk.x + 0.22;
      minZ = dk.z - 0.16;
      maxZ = dk.z + 0.16;
    } else {
      // Solid boundary with high collision tolerance to block walking straight into desks
      minX = dk.x - 0.5 - 0.15;
      maxX = dk.x + 0.5 + 0.15;
      minZ = dk.z - 0.26 - 0.15;
      maxZ = dk.z + 0.26 + 0.15;
    }

    if (x > minX && x < maxX && z > minZ && z < maxZ) {
      const distL = x - minX;
      const distR = maxX - x;
      const distT = z - minZ;
      const distB = maxZ - z;
      const minDist = Math.min(distL, distR, distT, distB);
      if (minDist === distL) x = minX;
      else if (minDist === distR) x = maxX;
      else if (minDist === distT) z = minZ;
      else z = maxZ;
    }
  }

  // 3. Resolve circular collisions for couch group, swimming pools, counter units
  for (const obs of OBSTACLES) {
    const isOurDesk = ourDesks.some((dk) => Math.abs(obs.x - dk.x) < 0.1 && Math.abs(obs.z - dk.z) < 0.1);
    if (isOurDesk) continue;

    const matchesObs1 = ignoreObs1 && Math.abs(obs.x - ignoreObs1.x) < 0.05 && Math.abs(obs.z - ignoreObs1.z) < 0.05;
    const matchesObs2 = ignoreObs2 && Math.abs(obs.x - ignoreObs2.x) < 0.05 && Math.abs(obs.z - ignoreObs2.z) < 0.05;

    let effectiveRadius = obs.r;
    if (matchesObs1 || matchesObs2) {
      // Allow the character to sit near the center of West, North, or South sofa cushions
      const isSofa =
        (Math.abs(obs.x - -3.8) < 0.1 && Math.abs(obs.z - -1.0) < 0.1) ||
        (Math.abs(obs.x - -2.4) < 0.1 && Math.abs(obs.z - -2.4) < 0.1) ||
        (Math.abs(obs.x - -2.4) < 0.1 && Math.abs(obs.z - 0.4) < 0.1);
      effectiveRadius = isSofa ? 0.0 : 0.35;
    } else {
      // Solid collision boundary plus extra physical frame spacing buffer
      effectiveRadius = obs.r + 0.12;
    }

    const dx = x - obs.x;
    const dz = z - obs.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < effectiveRadius) {
      const normalX = dx / (dist || 1);
      const normalZ = dz / (dist || 1);
      x = obs.x + normalX * effectiveRadius;
      z = obs.z + normalZ * effectiveRadius;
    }
  }

  return { x, z };
}

// Generates an elegant detour path of waypoints using the navigational matrix
function calculatePath(startX: number, startZ: number, targetX: number, targetZ: number): [number, number][] {
  const ignoreObsStart = getIgnoredObstacleForTarget(startX, startZ);
  const ignoreObsEnd = getIgnoredObstacleForTarget(targetX, targetZ);

  // Direct leg check - fast-path (ignores matching start or end obstacle collision profiles)
  if (!doesSegmentCollide(startX, startZ, targetX, targetZ, ignoreObsStart, ignoreObsEnd)) {
    return [[targetX, targetZ]];
  }

  // Multi-segment detour routing search
  let bestWp: [number, number] | null = null;
  let minDistance = Infinity;

  for (const wp of WAYPOINTS) {
    // 1st segment start -> wp (ignores start-associated obstacle like their current chair)
    // 2nd segment wp -> target (ignores target-associated obstacle like target chair)
    if (!doesSegmentCollide(startX, startZ, wp[0], wp[1], ignoreObsStart, null) && 
        !doesSegmentCollide(wp[0], wp[1], targetX, targetZ, null, ignoreObsEnd)) {
      const dist = Math.hypot(wp[0] - startX, wp[1] - startZ) + Math.hypot(targetX - wp[0], targetZ - wp[1]);
      if (dist < minDistance) {
        minDistance = dist;
        bestWp = wp;
      }
    }
  }

  if (bestWp) {
    return [bestWp, [targetX, targetZ]];
  }

  // Triple-segment fallback center junction bypass
  let startWp: [number, number] = [0, 0.2];
  let endWp: [number, number] = [0, 0.2];
  let minStartDist = Infinity;
  let minEndDist = Infinity;

  for (const wp of WAYPOINTS) {
    if (!doesSegmentCollide(startX, startZ, wp[0], wp[1], ignoreObsStart, null)) {
      const d = Math.hypot(wp[0] - startX, wp[1] - startZ);
      if (d < minStartDist) {
        minStartDist = d;
        startWp = wp;
      }
    }
    if (!doesSegmentCollide(wp[0], wp[1], targetX, targetZ, null, ignoreObsEnd)) {
      const d = Math.hypot(targetX - wp[0], targetZ - wp[1]);
      if (d < minEndDist) {
        minEndDist = d;
        endWp = wp;
      }
    }
  }

  if (startWp[0] === endWp[0] && startWp[1] === endWp[1]) {
    return [startWp, [targetX, targetZ]];
  } else {
    const path: [number, number][] = [startWp];
    if ((startWp[0] !== 0 || startWp[1] !== 0.2) && (endWp[0] !== 0 || endWp[1] !== 0.2)) {
      path.push([0, 0.2]);
    }
    path.push(endWp);
    path.push([targetX, targetZ]);
    return path;
  }
}

// Types matching the office simulation positions
interface AgentState {
  id: string;
  name: string;
  role: string;
  efficiency: number;
  variation: number;
  avatarColor: string;
  suitColor: string;
  hairColor: string;
  accessory: "glasses" | "tie" | "headphones" | "none";
  gender: "male" | "female";
  x: number;          // Current 3D X
  y: number;          // Current Height
  z: number;          // Current 3D Z
  targetX: number;    // Path target X
  targetZ: number;    // Path target Z
  state: "work" | "walk" | "coffee" | "water" | "talk" | "celebrate" | "stretch" | "pool" | "fridge" | "sofa";
  stateTimer: number;
  assignedAssetId: string | null;
  sitRotate?: number; // Y rotation when sitting
  currentSpotId?: string; // Semantic spot ID to prevent overlapping
  energy?: number;
  satiety?: number;
  happiness?: number;
  thought?: string;
  lifeStatus?: string;
  personality?: "workaholic" | "gamer" | "swimmer" | "socializer" | "chill";
}

interface ThreeOfficeSceneProps {
  agents: AgentState[];
  portfolioStats: {
    total: number;
    variationPercent: number;
    profit: number;
    isDemo: boolean;
    summaryText: string;
  };
  onSelectEntity: (entity: { type: "agent" | "asset"; id: string } | null) => void;
  selectedEntity: { type: "agent" | "asset"; id: string } | null;
  onAgentsUpdate?: (syncedAgents: AgentState[]) => void;
  isMarketOpen?: boolean;
  isActive?: boolean;
}

// Atmospheric particle floaters mimicking subtle glowing amber/green spores
function Particles() {
  const pointsRef = useRef<THREE.Points>(null);
  const particleCount = 25;

  const [positions, speeds] = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const sp = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 1] = Math.random() * 3;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 10;
      sp[i] = 0.002 + Math.random() * 0.003;
    }
    return [pos, sp];
  }, []);

  useFrame(() => {
    if (pointsRef.current) {
      const positionsArray = pointsRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        // Slowly rise
        positionsArray[i * 3 + 1] += speeds[i];
        // Dynamic horizontal float drift sway
        positionsArray[i * 3] += Math.sin(positionsArray[i * 3 + 1] + i) * 0.001;

        if (positionsArray[i * 3 + 1] > 3) {
          positionsArray[i * 3 + 1] = 0;
          positionsArray[i * 3] = (Math.random() - 0.5) * 10;
          positionsArray[i * 3 + 2] = (Math.random() - 0.5) * 10;
        }
      }
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={particleCount}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        color="#a7f3d0"
        transparent
        opacity={0.35}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

// Premium Voxel Agent model with sit, stand, walk animations and high match to screenshot
function VoxelAgent({ 
  agent, 
  onSelect, 
  isSelected,
  onFridgeProximityChange,
  isMarketOpen = true
}: { 
  agent: AgentState; 
  onSelect: () => void; 
  isSelected: boolean;
  onFridgeProximityChange?: (agentId: string, isNear: boolean) => void;
  isMarketOpen?: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const headGroupRef = useRef<THREE.Group>(null);

  // Checks state to hide active assets HUD overhead when inside another Tab or when Support modal is open
  const [labelsHidden, setLabelsHidden] = useState(false);

  useEffect(() => {
    const updateVisibility = () => {
      const officeEl = document.getElementById("virtual-office-room");
      const isOfficeHidden = officeEl ? officeEl.getBoundingClientRect().width === 0 : true;

      let isOpenModal = false;
      try {
        // Safe standard selectors that will never throw a SyntaxError
        const modalDialog = document.querySelector('[role="dialog"]');
        const customModal = document.querySelector('[data-modal]');
        const backdropSm = document.querySelector('.backdrop-blur-sm');
        const backdropXs = document.querySelector('.backdrop-blur-xs');

        isOpenModal = !!(modalDialog || customModal || backdropSm || backdropXs);
      } catch (err) {
        console.warn("Visibility check query failed safely:", err);
      }

      setLabelsHidden(isOfficeHidden || isOpenModal);
    };

    updateVisibility();
    const interval = setInterval(updateVisibility, 350);
    window.addEventListener("click", updateVisibility);
    window.addEventListener("touchend", updateVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener("click", updateVisibility);
      window.removeEventListener("touchend", updateVisibility);
    };
  }, []);

  // Initialize starting position of the model container exactly once to avoid React re-render snapping/jittering
  const [initialPos] = useState<[number, number, number]>(() => {
    let y = 0;
    if (agent.state === "pool") y = -0.3;
    else if (agent.state === "work") y = 0.02;
    else if (agent.state === "sofa") y = 0.09;
    return [agent.x, y, agent.z];
  });

  const smoothedYRef = useRef(initialPos[1]);

  // Track path planning waypoints locally at high speed
  const pathRef = useRef<[number, number][]>([]);
  const lastTargetRef = useRef<[number, number]>([Infinity, Infinity]);
  const stuckFramesRef = useRef(0);

  // Refrigerator proximity state tracking
  const isCloseToFridgeRef = useRef(false);
  useEffect(() => {
    return () => {
      if (isCloseToFridgeRef.current) {
        onFridgeProximityChange?.(agent.id, false);
      }
    };
  }, [agent.id, onFridgeProximityChange]);

  // Keep a reference to the latest agent state so useFrame never runs on stale props
  const agentRef = useRef(agent);
  useEffect(() => {
    agentRef.current = agent;
    
    // Automatically recalculate walk route around solid furniture when a new target destination is assigned
    if (groupRef.current) {
      const curX = groupRef.current.position.x;
      const curZ = groupRef.current.position.z;
      if (agent.targetX !== lastTargetRef.current[0] || agent.targetZ !== lastTargetRef.current[1]) {
        lastTargetRef.current = [agent.targetX, agent.targetZ];
        pathRef.current = calculatePath(curX, curZ, agent.targetX, agent.targetZ);
      }
    }
  }, [agent]);

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();
    const currentAgent = agentRef.current;
    if (groupRef.current) {
      // Choose intermediate walkthrough waypoint from the calculated path, or default to final destination
      let activeTX = currentAgent.targetX;
      let activeTZ = currentAgent.targetZ;

      if (pathRef.current && pathRef.current.length > 0) {
        const nextWp = pathRef.current[0];
        activeTX = nextWp[0];
        activeTZ = nextWp[1];
      }

      // Calculate delta to the ACTIVE waypoint/target
      const dx = activeTX - groupRef.current.position.x;
      const dz = activeTZ - groupRef.current.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const isSitting = currentAgent.state === "work";

      // If we arrived close to our intermediate layout waypoint, advance to the next segment
      if (dist < 0.12 && pathRef.current && pathRef.current.length > 0) {
        pathRef.current.shift();
      }

      // Recompute distance check for standard state transition vs walkthrough
      const dxFinal = currentAgent.targetX - groupRef.current.position.x;
      const dzFinal = currentAgent.targetZ - groupRef.current.position.z;
      const distFinal = Math.sqrt(dxFinal * dxFinal + dzFinal * dzFinal);

      // Interpolate the base height smoothly (especially for entering/exiting the pool and sitting down)
      let targetBaseY = 0;
      if (currentAgent.state === "pool") {
        if (distFinal <= 1.2) {
          targetBaseY = -0.3;
        } else {
          targetBaseY = 0;
        }
      } else if (currentAgent.state === "work" && distFinal <= 0.08) {
        targetBaseY = 0.02;
      } else if (currentAgent.state === "sofa" && distFinal <= 0.08) {
        targetBaseY = 0.09;
      }

      smoothedYRef.current = THREE.MathUtils.lerp(
        smoothedYRef.current,
        targetBaseY,
        Math.min(1.0, 10 * delta)
      );

      // Refrigerator proximity detection
      const distToFridgeX = groupRef.current.position.x - (-4.3);
      const distToFridgeZ = groupRef.current.position.z - (-3.9);
      const distToFridge = Math.sqrt(distToFridgeX * distToFridgeX + distToFridgeZ * distToFridgeZ);
      const isNearFridge = currentAgent.state === "fridge" && distToFridge < 0.65;

      if (isNearFridge !== isCloseToFridgeRef.current) {
        isCloseToFridgeRef.current = isNearFridge;
        onFridgeProximityChange?.(currentAgent.id, isNearFridge);
      }

      if (distFinal > 0.08) {
        // 1. Walking Routine
        const walkSpeed = 1.0 * Math.min(0.06, delta);
        // Proceed towards the CURRENT active node (avoiding desks / objects)
        const currentX = groupRef.current.position.x;
        const currentZ = groupRef.current.position.z;
        const proposedX = currentX + (dx / (dist || 1)) * walkSpeed;
        const proposedZ = currentZ + (dz / (dist || 1)) * walkSpeed;

        // Get starting and ending ignored obstacle profiles dynamically 
        const ignoreObsStart = getIgnoredObstacleForTarget(currentX, currentZ);
        const ignoreObsEnd = getIgnoredObstacleForTarget(currentAgent.targetX, currentAgent.targetZ);

        // Resolve absolute circular or box boundaries to create a physical hard barrier
        const resolved = resolveRigidCollisions(proposedX, proposedZ, ignoreObsStart, ignoreObsEnd);

        // Stuck/lag detection and recovery system
        const realDx = resolved.x - currentX;
        const realDz = resolved.z - currentZ;
        const realMoved = Math.sqrt(realDx * realDx + realDz * realDz);

        if (realMoved < walkSpeed * 0.15) {
          stuckFramesRef.current += 1;
        } else {
          stuckFramesRef.current = Math.max(0, stuckFramesRef.current - 1);
        }

        // Recovery: Skip waypoint at 15 frames. At 50 frames, snap directly to destination to completely eliminate lag!
        if (stuckFramesRef.current > 50) {
          resolved.x = currentAgent.targetX;
          resolved.z = currentAgent.targetZ;
          pathRef.current = [];
          stuckFramesRef.current = 0;
        } else if (stuckFramesRef.current > 15) {
          if (pathRef.current && pathRef.current.length > 0) {
            pathRef.current.shift();
          } else {
            // Nudge them directly towards final destination
            const dirX = currentAgent.targetX - currentX;
            const dirZ = currentAgent.targetZ - currentZ;
            const dirLen = Math.sqrt(dirX * dirX + dirZ * dirZ);
            if (dirLen > 0) {
              resolved.x = currentX + (dirX / dirLen) * 0.15;
              resolved.z = currentZ + (dirZ / dirLen) * 0.15;
            }
          }
        }

        groupRef.current.position.x = resolved.x;
        groupRef.current.position.z = resolved.z;

        // Turn towards active moving vector smoothly
        const angle = Math.atan2(-dz, dx);
        groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, angle + Math.PI / 2, 0.25);

        // Swings limbs & resets Y/Z to keep them straight while walking
        const freq = 6.0;
        if (leftLegRef.current) {
          leftLegRef.current.rotation.x = Math.sin(time * freq) * 0.55;
          leftLegRef.current.rotation.y = 0;
          leftLegRef.current.rotation.z = 0;
          leftLegRef.current.position.set(-0.06, 0.12, 0);
        }
        if (rightLegRef.current) {
          rightLegRef.current.rotation.x = -Math.sin(time * freq) * 0.55;
          rightLegRef.current.rotation.y = 0;
          rightLegRef.current.rotation.z = 0;
          rightLegRef.current.position.set(0.06, 0.12, 0);
        }
        if (leftArmRef.current) {
          leftArmRef.current.rotation.x = -Math.sin(time * freq) * 0.45;
          leftArmRef.current.rotation.y = 0;
          leftArmRef.current.rotation.z = 0;
        }
        if (rightArmRef.current) {
          rightArmRef.current.rotation.x = Math.sin(time * freq) * 0.45;
          rightArmRef.current.rotation.y = 0;
          rightArmRef.current.rotation.z = 0;
        }

        // Dynamic walking altitude bounce bob with smooth height base
        groupRef.current.position.y = smoothedYRef.current + Math.abs(Math.sin(time * freq)) * 0.04;
      } else {
        // 2. State specific static idle routines
        if (isSitting) {
          // Sitting at workspace
          groupRef.current.position.x = currentAgent.targetX;
          groupRef.current.position.z = currentAgent.targetZ;
          groupRef.current.position.y = smoothedYRef.current; // sit elegantly on the chair cushion matching its height (0.25)

          if (currentAgent.sitRotate !== undefined) {
            groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, currentAgent.sitRotate, 0.15);
          }

          // Adjust legs sit angle pointing forward
          if (leftLegRef.current) {
            leftLegRef.current.rotation.x = -Math.PI / 2;
            leftLegRef.current.rotation.y = 0;
            leftLegRef.current.rotation.z = 0;
            leftLegRef.current.position.set(-0.06, 0.16, 0.06);
          }
          if (rightLegRef.current) {
            rightLegRef.current.rotation.x = -Math.PI / 2;
            rightLegRef.current.rotation.y = 0;
            rightLegRef.current.rotation.z = 0;
            rightLegRef.current.position.set(0.06, 0.16, 0.06);
          }

          // Fast keyboard typing arm micro motion
          const typeFreq = 22;
          if (leftArmRef.current) {
            leftArmRef.current.rotation.x = -Math.PI / 3.2 + Math.sin(time * typeFreq) * 0.2;
            leftArmRef.current.rotation.y = 0.08;
            leftArmRef.current.rotation.z = 0;
          }
          if (rightArmRef.current) {
            rightArmRef.current.rotation.x = -Math.PI / 3.2 + Math.cos(time * typeFreq) * 0.2;
            rightArmRef.current.rotation.y = -0.08;
            rightArmRef.current.rotation.z = 0;
          }

          // Focused head screen-looking nod
          if (headGroupRef.current) {
            headGroupRef.current.position.y = 0.77 + Math.sin(time * 5) * 0.005;
          }
        } else {
          // Standard standing conversation / breakroom idle presets
          // Snap exact standing coordinates to prevent drifting anomalies upon arriving
          groupRef.current.position.x = currentAgent.targetX;
          groupRef.current.position.z = currentAgent.targetZ;

          // Reset Z tilt by default unless stretching
          if (currentAgent.state !== "stretch") {
            groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, 0, 0.15);
          }

          // Align legs straight down by default unless celebrating
          if (leftLegRef.current) {
            leftLegRef.current.rotation.x = THREE.MathUtils.lerp(leftLegRef.current.rotation.x, 0, 0.25);
            leftLegRef.current.rotation.y = 0;
            leftLegRef.current.rotation.z = 0;
            leftLegRef.current.position.set(-0.06, 0.12, 0);
          }
          if (rightLegRef.current) {
            rightLegRef.current.rotation.x = THREE.MathUtils.lerp(rightLegRef.current.rotation.x, 0, 0.25);
            rightLegRef.current.rotation.y = 0;
            rightLegRef.current.rotation.z = 0;
            rightLegRef.current.position.set(0.06, 0.12, 0);
          }

          // Custom state animation handlers
          const idleFreq = 2.0;

          if (currentAgent.state === "celebrate") {
            // 2A. CELEBRATION DANCE JUMP STATE
            // Fun voxel bounce jump!
            groupRef.current.position.y = smoothedYRef.current + Math.max(0, Math.sin(time * 12.0) * 0.22);
            // Slowly rotate or spin in delight!
            groupRef.current.rotation.y += 0.04;

            // Thrilled arm waving motion
            if (leftArmRef.current) {
              leftArmRef.current.rotation.x = -Math.PI + Math.sin(time * 12) * 0.5;
              leftArmRef.current.rotation.y = 0;
              leftArmRef.current.rotation.z = -Math.PI / 4 + Math.sin(time * 8) * 0.3;
            }
            if (rightArmRef.current) {
              rightArmRef.current.rotation.x = -Math.PI + Math.cos(time * 12) * 0.5;
              rightArmRef.current.rotation.y = 0;
              rightArmRef.current.rotation.z = Math.PI / 4 + Math.cos(time * 8) * 0.3;
            }
            if (headGroupRef.current) {
              headGroupRef.current.position.y = 0.77 + Math.sin(time * 12) * 0.015;
              headGroupRef.current.rotation.x = -0.2; // look up in joy
              headGroupRef.current.rotation.y = Math.sin(time * 8) * 0.15;
            }

          } else if (currentAgent.state === "coffee") {
            // 2B. COFFEE SIPPING STATE
            groupRef.current.position.y = smoothedYRef.current;
            // Face the left coffee counter smoothly
            groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, -Math.PI / 2, 0.1);

            // Left arm is relaxed
            if (leftArmRef.current) {
              leftArmRef.current.rotation.x = Math.sin(time * idleFreq) * 0.04;
              leftArmRef.current.rotation.y = 0;
              leftArmRef.current.rotation.z = 0;
            }
            // Right arm raises a cup to the mouth periodically (taking a sip every few seconds)
            if (rightArmRef.current) {
              const sipTimer = Math.sin(time * 1.5);
              if (sipTimer > 0.2) {
                // Raised drinking cup pose
                rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, -Math.PI / 2.1, 0.15);
                rightArmRef.current.rotation.y = -0.15;
                rightArmRef.current.rotation.z = -Math.PI / 10;
              } else {
                // Standing resting pose holding a glass near chest
                rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, -Math.PI / 4, 0.15);
                rightArmRef.current.rotation.y = -0.05;
                rightArmRef.current.rotation.z = -0.05;
              }
            }
            if (headGroupRef.current) {
              headGroupRef.current.position.y = 0.77 + Math.sin(time * idleFreq) * 0.005;
              headGroupRef.current.rotation.x = Math.sin(time * 1.5) > 0.2 ? 0.12 : 0; // head tilts down slightly when drinking
              headGroupRef.current.rotation.y = 0;
            }

          } else if (currentAgent.state === "water") {
            // 2C. WATER COOLER REFRESH STATE
            groupRef.current.position.y = smoothedYRef.current;
            // Face water cooler direction (North, toward back wall)
            groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, 0, 0.1);

            // Raise left hand/arm up holding refreshing cup
            if (leftArmRef.current) {
              leftArmRef.current.rotation.x = -Math.PI / 4 + Math.sin(time * 2) * 0.05;
              leftArmRef.current.rotation.y = 0.05;
              leftArmRef.current.rotation.z = 0;
            }
            if (rightArmRef.current) {
              rightArmRef.current.rotation.x = Math.sin(time * idleFreq) * 0.05;
              rightArmRef.current.rotation.y = 0;
              rightArmRef.current.rotation.z = 0;
            }
            if (headGroupRef.current) {
              // Looking up and breathing deeply
              const breath = Math.sin(time * 1.2);
              headGroupRef.current.position.y = 0.77 + breath * 0.012;
              headGroupRef.current.rotation.x = -0.15 + breath * 0.03;
              headGroupRef.current.rotation.y = 0;
            }

          } else if (currentAgent.state === "stretch") {
            // 2D. HEALTHY OFFICE STRETCH STATE
            groupRef.current.position.y = smoothedYRef.current;
            // Stretch sway
            groupRef.current.rotation.z = Math.sin(time * 1.5) * 0.04;

            // Expand both arms outwards to stretch pectorals and joints
            if (leftArmRef.current) {
              leftArmRef.current.rotation.x = Math.sin(time * 3) * 0.1;
              leftArmRef.current.rotation.y = 0;
              leftArmRef.current.rotation.z = -Math.PI / 2.2 + Math.sin(time * 3.5) * 0.15;
            }
            if (rightArmRef.current) {
              rightArmRef.current.rotation.x = Math.cos(time * 3) * 0.1;
              rightArmRef.current.rotation.y = 0;
              rightArmRef.current.rotation.z = Math.PI / 2.2 + Math.cos(time * 3.5) * 0.15;
            }
            if (headGroupRef.current) {
              // Neck rolls in circles!
              headGroupRef.current.position.y = 0.77;
              headGroupRef.current.rotation.y = Math.sin(time * 2.0) * 0.28;
              headGroupRef.current.rotation.x = Math.cos(time * 2.0) * 0.15;
            }

          } else if (currentAgent.state === "pool") {
            // 2F. POOL CHILLING / SWIMMING STATE
            // Sink characters slightly under the water surface + add gentle bobbing!
            groupRef.current.position.y = smoothedYRef.current + Math.sin(time * 3.0) * 0.08;
            // Face forward / pool center
            groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, Math.PI / 4 + Math.sin(time * 0.5) * 0.5, 0.1);

            if (leftArmRef.current) {
              leftArmRef.current.rotation.x = -Math.PI / 3 + Math.sin(time * 3.0) * 0.25;
              leftArmRef.current.rotation.y = 0.2;
              leftArmRef.current.rotation.z = -Math.PI / 6;
            }
            if (rightArmRef.current) {
              rightArmRef.current.rotation.x = -Math.PI / 3 + Math.cos(time * 3.0) * 0.25;
              rightArmRef.current.rotation.y = -0.2;
              rightArmRef.current.rotation.z = Math.PI / 6;
            }
            if (headGroupRef.current) {
              headGroupRef.current.position.y = 0.77 + Math.sin(time * 3.0) * 0.01;
              headGroupRef.current.rotation.x = -0.05 + Math.sin(time * 1.5) * 0.05;
              headGroupRef.current.rotation.y = Math.sin(time * 0.8) * 0.2;
            }

          } else if (currentAgent.state === "sofa") {
            // 2G. SOFA CHILL / REST STATE
            // Settle them comfortably down on the sofa cushion
            groupRef.current.position.x = currentAgent.targetX;
            groupRef.current.position.z = currentAgent.targetZ;
            groupRef.current.position.y = smoothedYRef.current; // sit elegantly on top of the soft sofa cushion matching its height (0.295)

            if (currentAgent.sitRotate !== undefined) {
              groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, currentAgent.sitRotate, 0.15);
            }

            // Slide legs relaxed extending forward (towards positive Z of character)
            if (leftLegRef.current) {
              leftLegRef.current.rotation.x = -Math.PI / 2;
              leftLegRef.current.rotation.y = 0.08;
              leftLegRef.current.rotation.z = 0;
              leftLegRef.current.position.set(-0.06, 0.16, 0.06);
            }
            if (rightLegRef.current) {
              rightLegRef.current.rotation.x = -Math.PI / 2;
              rightLegRef.current.rotation.y = -0.08;
              rightLegRef.current.rotation.z = 0;
              rightLegRef.current.position.set(0.06, 0.16, 0.06);
            }

            // Arms holding a controller and feverishly mashing buttons!
            if (leftArmRef.current) {
              leftArmRef.current.rotation.x = -Math.PI / 2.3 + Math.sin(time * 14) * 0.04;
              leftArmRef.current.rotation.y = 0.22;
              leftArmRef.current.rotation.z = 0.05;
            }
            if (rightArmRef.current) {
              rightArmRef.current.rotation.x = -Math.PI / 2.3 + Math.cos(time * 14) * 0.04;
              rightArmRef.current.rotation.y = -0.22;
              rightArmRef.current.rotation.z = -0.05;
            }

            // Head focused looking directly at the TV screen with tense gaming micro-vibrations
            if (headGroupRef.current) {
              headGroupRef.current.position.y = 0.77 + Math.sin(time * 2.0) * 0.004;
              headGroupRef.current.rotation.x = 0.08 + Math.sin(time * 12.0) * 0.02;
              headGroupRef.current.rotation.y = 0; // looking straight at the TV Screen
            }

          } else if (currentAgent.state === "walk") {
            // 2H. PHONE CHECKING & MICRO-SCROLLING ACTIVITIES (Pessoas não ficam desocupadas parado no meio!)
            groupRef.current.position.y = smoothedYRef.current;

            // Raise right arm holding phone
            if (rightArmRef.current) {
              rightArmRef.current.rotation.x = -Math.PI / 2.5 + Math.sin(time * 3) * 0.06;
              rightArmRef.current.rotation.y = -Math.PI / 12;
              rightArmRef.current.rotation.z = -Math.PI / 6;
            }
            if (leftArmRef.current) {
              // Left arm hand taps/swipes smartphone screen
              leftArmRef.current.rotation.x = -Math.PI / 4.2 + Math.cos(time * 5.5) * 0.08;
              leftArmRef.current.rotation.y = Math.PI / 10;
              leftArmRef.current.rotation.z = Math.PI / 8;
            }
            if (headGroupRef.current) {
              // Tilt head down to look at smartphone
              headGroupRef.current.position.y = 0.77;
              headGroupRef.current.rotation.x = 0.22 + Math.sin(time * 1.5) * 0.02; // focus down slightly
              headGroupRef.current.rotation.y = Math.sin(time * 0.5) * 0.1;
            }

          } else if (currentAgent.state === "fridge") {
            // 2H. FRIDGE EATING SNACK STATE
            groupRef.current.position.y = smoothedYRef.current;
            // Face the refrigerator (looks North towards back wall)
            groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, Math.PI, 0.1);

            // Left arm is relaxed
            if (leftArmRef.current) {
              leftArmRef.current.rotation.x = Math.sin(time * idleFreq) * 0.04;
              leftArmRef.current.rotation.y = 0;
              leftArmRef.current.rotation.z = 0;
            }
            
            // Right arm raises food to the mouth periodically (eating model)
            if (rightArmRef.current) {
              const munchPeriod = Math.sin(time * 1.8);
              if (munchPeriod > 0.1) {
                // Raise arm to mouth to munch
                rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, -Math.PI / 2.0, 0.18);
                rightArmRef.current.rotation.y = -0.18;
                rightArmRef.current.rotation.z = -Math.PI / 8;
              } else {
                // Hold snack down near chest
                rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, -Math.PI / 4.2, 0.18);
                rightArmRef.current.rotation.y = -0.06;
                rightArmRef.current.rotation.z = -0.06;
              }
            }
            if (headGroupRef.current) {
              headGroupRef.current.position.y = 0.77 + Math.sin(time * 1.8) * 0.008; // slight chewing head nod bob
              headGroupRef.current.rotation.x = Math.sin(time * 1.8) > 0.1 ? 0.08 : 0;
              headGroupRef.current.rotation.y = 0;
            }

          } else {
            // 2E. STANDARD CONVERSATION / MEET STATE ("talk" / default idle)
            groupRef.current.position.y = 0;

            if (leftArmRef.current) {
              leftArmRef.current.rotation.x = Math.sin(time * idleFreq) * 0.06;
              leftArmRef.current.rotation.y = 0;
              leftArmRef.current.rotation.z = 0;
            }
            if (rightArmRef.current) {
              if (currentAgent.state === "talk") {
                // Active conversational gesturing
                rightArmRef.current.rotation.x = -0.7 + Math.sin(time * 6) * 0.22;
                rightArmRef.current.rotation.y = 0;
                rightArmRef.current.rotation.z = Math.sin(time * 4) * 0.08;
              } else {
                rightArmRef.current.rotation.x = -Math.sin(time * idleFreq) * 0.06;
                rightArmRef.current.rotation.y = 0;
                rightArmRef.current.rotation.z = 0;
              }
            }
            if (headGroupRef.current) {
              headGroupRef.current.position.y = 0.77 + Math.sin(time * idleFreq) * 0.006;
              if (currentAgent.state === "talk") {
                headGroupRef.current.rotation.x = 0;
                headGroupRef.current.rotation.y = Math.sin(time * 3) * 0.12;
              } else {
                headGroupRef.current.rotation.x = 0;
                headGroupRef.current.rotation.y = THREE.MathUtils.lerp(headGroupRef.current.rotation.y, 0, 0.1);
              }
            }
          }
        }
      }
    }
  });

  return (
    <group
      ref={groupRef}
      position={initialPos}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* 1. Torso Suit / Skirt Jacket */}
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.26, 0.35, 0.15]} />
        <meshStandardMaterial color={agent.suitColor} roughness={0.65} />
      </mesh>

      {/* Corporate Tie block detail */}
      {agent.accessory === "tie" && (
        <mesh position={[0, 0.41, 0.076]} castShadow>
          <boxGeometry args={[0.04, 0.16, 0.012]} />
          <meshStandardMaterial color="#ef4444" roughness={0.7} /> {/* Beto's bright red tie */}
        </mesh>
      )}

      {/* Corporate female skirt trim block if female (Bia) */}
      {agent.gender === "female" && (
        <mesh position={[0, 0.23, 0]} castShadow>
          <boxGeometry args={[0.27, 0.08, 0.16]} />
          <meshStandardMaterial color={agent.suitColor} roughness={0.65} />
        </mesh>
      )}

      {/* 2. Office Worker Head & Custom Hair shapes */}
      <group ref={headGroupRef} position={[0, 0.77, 0]}>
        {/* Skin block */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.22, 0.22, 0.22]} />
          <meshStandardMaterial color="#fcd34d" roughness={0.4} /> {/* warm voxel skin tone */}
        </mesh>

        {/* Pixel Eyes */}
        <mesh position={[-0.05, 0.02, 0.111]}>
          <boxGeometry args={[0.025, 0.025, 0.01]} />
          <meshStandardMaterial color="#111827" roughness={0.1} />
        </mesh>
        <mesh position={[0.05, 0.02, 0.111]}>
          <boxGeometry args={[0.025, 0.025, 0.01]} />
          <meshStandardMaterial color="#111827" roughness={0.1} />
        </mesh>

        {/* Hair structures mapping */}
        {agent.gender === "female" ? (
          // Bia's hair: Brown elegant voxel bob cut hanging down sides
          <group>
            {/* Top crown hair cap */}
            <mesh position={[0, 0.11, -0.01]} castShadow>
              <boxGeometry args={[0.24, 0.06, 0.24]} />
              <meshStandardMaterial color={agent.hairColor} roughness={0.8} />
            </mesh>
            {/* Back bob length */}
            <mesh position={[0, 0.0, -0.08]} castShadow>
              <boxGeometry args={[0.24, 0.16, 0.08]} />
              <meshStandardMaterial color={agent.hairColor} roughness={0.8} />
            </mesh>
            {/* Left front hang */}
            <mesh position={[-0.11, -0.02, 0.02]} castShadow>
              <boxGeometry args={[0.03, 0.2, 0.16]} />
              <meshStandardMaterial color={agent.hairColor} roughness={0.8} />
            </mesh>
            {/* Right front hang */}
            <mesh position={[0.11, -0.02, 0.02]} castShadow>
              <boxGeometry args={[0.03, 0.2, 0.16]} />
              <meshStandardMaterial color={agent.hairColor} roughness={0.8} />
            </mesh>
          </group>
        ) : (
          // Male Voxel Hair (Alô, Beto, Leo)
          <group>
            {/* Top crown hair cap */}
            <mesh position={[0, 0.11, -0.01]} castShadow>
              <boxGeometry args={[0.24, 0.06, 0.24]} />
              <meshStandardMaterial color={agent.hairColor} roughness={0.8} />
            </mesh>
            {/* Back trim */}
            <mesh position={[0, 0.03, -0.08]} castShadow>
              <boxGeometry args={[0.24, 0.11, 0.08]} />
              <meshStandardMaterial color={agent.hairColor} roughness={0.8} />
            </mesh>
            {/* Front voxel bangs/spike */}
            <mesh position={[0, 0.11, 0.08]} castShadow>
              <boxGeometry args={[0.22, 0.04, 0.06]} />
              <meshStandardMaterial color={agent.hairColor} roughness={0.7} />
            </mesh>
          </group>
        )}

        {/* Glasses accessory (Alô's signature black cool sunglasses) */}
        {agent.accessory === "glasses" && (
          <group position={[0, 0.02, 0.08]}>
            {/* Left lens */}
            <mesh position={[-0.05, 0, 0.035]} castShadow>
              <boxGeometry args={[0.07, 0.05, 0.01]} />
              <meshStandardMaterial color="#111827" roughness={0.1} metalness={0.9} />
            </mesh>
            {/* Right lens */}
            <mesh position={[0.05, 0, 0.035]} castShadow>
              <boxGeometry args={[0.07, 0.05, 0.01]} />
              <meshStandardMaterial color="#111827" roughness={0.1} metalness={0.9} />
            </mesh>
            {/* Nose bridge */}
            <mesh position={[0, 0.01, 0.035]}>
              <boxGeometry args={[0.04, 0.015, 0.01]} />
              <meshStandardMaterial color="#111827" />
            </mesh>
            {/* Temple left */}
            <mesh position={[-0.11, 0.01, -0.04]} rotation={[0, 0.05, 0]}>
              <boxGeometry args={[0.01, 0.015, 0.14]} />
              <meshStandardMaterial color="#111827" />
            </mesh>
            {/* Temple right */}
            <mesh position={[0.11, 0.01, -0.04]} rotation={[0, -0.05, 0]}>
              <boxGeometry args={[0.01, 0.015, 0.14]} />
              <meshStandardMaterial color="#111827" />
            </mesh>
          </group>
        )}
      </group>

      {/* 3. Legs */}
      <mesh ref={leftLegRef} position={[-0.06, 0.12, 0]} castShadow>
        <boxGeometry args={[0.07, 0.22, 0.07]} />
        <meshStandardMaterial color={agent.gender === "female" ? "#fcd34d" : agent.suitColor} roughness={0.65} />
      </mesh>
      <mesh ref={rightLegRef} position={[0.06, 0.12, 0]} castShadow>
        <boxGeometry args={[0.07, 0.22, 0.07]} />
        <meshStandardMaterial color={agent.gender === "female" ? "#fcd34d" : agent.suitColor} roughness={0.65} />
      </mesh>

      {/* 4. Arms */}
      <mesh ref={leftArmRef} position={[-0.16, 0.42, 0]} castShadow>
        <boxGeometry args={[0.06, 0.22, 0.06]} />
        <meshStandardMaterial color={agent.suitColor} roughness={0.65} />
      </mesh>
      <mesh ref={rightArmRef} position={[0.16, 0.42, 0]} castShadow>
        <boxGeometry args={[0.06, 0.22, 0.06]} />
        <meshStandardMaterial color={agent.suitColor} roughness={0.65} />
        {/* Glowing smartphone 📱 inside their hand when they are in "walk" idling state so they are always doing something! */}
        {agent.state === "walk" && (
          <group position={[0, -0.11, 0.05]}>
            {/* Phone casing */}
            <mesh castShadow>
              <boxGeometry args={[0.03, 0.06, 0.01]} />
              <meshStandardMaterial color="#1e293b" roughness={0.5} />
            </mesh>
            {/* Phone screen glowing blue light */}
            <mesh position={[0, 0, 0.006]}>
              <boxGeometry args={[0.024, 0.052, 0.002]} />
              <meshBasicMaterial color="#38bdf8" />
            </mesh>
          </group>
        )}
      </mesh>

      {/* 4B. Voxel Game Controller (Only if sitting on sofa!) */}
      {agent.state === "sofa" && (
        <group position={[0, 0.30, 0.16]}>
          {/* Main controller chassis */}
          <mesh castShadow>
            <boxGeometry args={[0.14, 0.03, 0.07]} />
            <meshStandardMaterial color="#1f2937" roughness={0.6} />
          </mesh>
          {/* Left handle grip */}
          <mesh position={[-0.06, -0.015, -0.01]} rotation={[0.2, 0, -0.4]} castShadow>
            <boxGeometry args={[0.03, 0.03, 0.08]} />
            <meshStandardMaterial color="#111827" />
          </mesh>
          {/* Right handle grip */}
          <mesh position={[0.06, -0.015, -0.01]} rotation={[0.2, 0, 0.4]} castShadow>
            <boxGeometry args={[0.03, 0.03, 0.08]} />
            <meshStandardMaterial color="#111827" />
          </mesh>
          {/* Glowing neon led status blue/cyan screen light */}
          <mesh position={[0, 0.016, 0.01]}>
            <boxGeometry args={[0.03, 0.005, 0.01]} />
            <meshBasicMaterial color="#06b6d4" />
          </mesh>
        </group>
      )}

      {/* Selection Glow Indicator */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
          <ringGeometry args={[0.26, 0.32, 32]} />
          <meshBasicMaterial color="#10b981" side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Floating Worker Hub - Contain dynamic HUD metadata */}
      {!labelsHidden && (
        <Html position={[0, 1.25, 0]} center distanceFactor={14}>
          <div className="flex flex-col items-center select-none pointer-events-none relative mb-1" style={{ contentVisibility: "auto" }}>
            {/* EMPLOYEE SYSTEM TAG */}
            <div 
              className={`flex items-center gap-1.5 bg-[#0c0f13]/95 border ${isSelected ? "border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.25)]" : "border-stone-800/80"} rounded px-2 py-0.5 shadow-[0_4px_12px_rgba(0,0,0,0.6)] font-mono text-[8px] transition-all duration-300`}
              id={`employee-tag-${agent.id}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${agent.variation >= 0 ? "bg-emerald-500" : "bg-rose-500"} shrink-0`} />
              <span className="font-bold text-stone-200 tracking-wider text-[8px]">{agent.name}</span>
              <span className={`ml-1 font-extrabold text-[7.5px] ${agent.variation >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {agent.variation >= 0 ? "+" : ""}{agent.variation.toFixed(1)}%
              </span>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

// Subcomponent: CBD Swimming Pool with ladder details
function CdbPool({ position, onSelect, isSelected }: { position: [number, number, number], onSelect: () => void, isSelected: boolean }) {
  return (
    <group position={position} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {/* Pool flange borders */}
      <mesh position={[0, 0.02, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.0, 0.04, 2.0]} />
        <meshStandardMaterial color="#ffffff" roughness={0.4} />
      </mesh>
      
      {/* Water layer with clean vibrant pool-blue */}
      <mesh position={[0, 0.025, 0]}>
        <boxGeometry args={[1.6, 0.01, 1.6]} />
        <meshStandardMaterial 
          color="#0284c7" 
          transparent 
          opacity={0.80} 
          roughness={0.08} 
          metalness={0.15}
        />
      </mesh>

      {/* Pool bottom core container cavity cutout block */}
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[1.65, 0.2, 1.65]} />
        <meshStandardMaterial color="#0c1d32" roughness={0.9} />
      </mesh>

      {/* Double railing metal climbing ladder */}
    </group>
  );
}

// Subcomponent: Mini Piscina (Mini pool / relax spa tub in back right)
function MiniPiscina() {
  return (
    <group position={[3.6, 0, -3.6]}>
      {/* 1. Wood Deck Base Framing */}
      <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.9, 0.24, 1.9]} />
        <meshStandardMaterial color="#854d0e" roughness={0.7} /> {/* rich teak wood deck */}
      </mesh>

      {/* Solid wood top rim lip (creates beautiful thick border) */}
      <group position={[0, 0.245, 0]}>
        {/* Front & Back borders */}
        <mesh position={[0, 0, 0.88]} castShadow>
          <boxGeometry args={[1.9, 0.04, 0.14]} />
          <meshStandardMaterial color="#5c2e0b" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0, -0.88]} castShadow>
          <boxGeometry args={[1.9, 0.04, 0.14]} />
          <meshStandardMaterial color="#5c2e0b" roughness={0.8} />
        </mesh>
        {/* Left & Right borders */}
        <mesh position={[0.88, 0, 0]} castShadow>
          <boxGeometry args={[0.14, 0.04, 1.62]} />
          <meshStandardMaterial color="#5c2e0b" roughness={0.8} />
        </mesh>
        <mesh position={[-0.88, 0, 0]} castShadow>
          <boxGeometry args={[0.14, 0.04, 1.62]} />
          <meshStandardMaterial color="#5c2e0b" roughness={0.8} />
        </mesh>
      </group>

      {/* 2. Pool Tiled Bottom (Sub-level ground tile look) */}
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[1.62, 0.01, 1.62]} />
        <meshStandardMaterial color="#7dd3fc" roughness={0.4} />
      </mesh>

      {/* 3. Solid Water Layer (Stunning vibrant pool-blue!) */}
      <mesh position={[0, 0.22, 0]} castShadow>
        <boxGeometry args={[1.62, 0.02, 1.62]} />
        <meshStandardMaterial 
          color="#38bdf8" 
          transparent
          opacity={0.75}
          roughness={0.05}
          metalness={0.1}
          emissive="#0ea5e9"
          emissiveIntensity={0.15}
        />
      </mesh>

      {/* Mini Pool Ladder (Two silver metal arch rods) */}
      <group position={[-0.6, 0.22, -0.75]}>
        {/* Left vertical bar */}
        <mesh position={[-0.15, 0.22, 0]} castShadow>
          <boxGeometry args={[0.03, 0.44, 0.03]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
        </mesh>
        {/* Right vertical bar */}
        <mesh position={[0.15, 0.22, 0]} castShadow>
          <boxGeometry args={[0.03, 0.44, 0.03]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
        </mesh>
        {/* Horizontal arch cap bars */}
        <mesh position={[0, 0.44, -0.06]} castShadow>
          <boxGeometry args={[0.33, 0.03, 0.15]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
        </mesh>
      </group>

      {/* Beside pool: Clean styled pool area without beach clutter */}
      </group>
  );
}

// Subcomponent: Grey security safebox cube with wheel lock details (Executive Safe)
function BossVaultSafe({ position, onSelect, isSelected }: { position: [number, number, number], onSelect: () => void, isSelected: boolean }) {
  const wheelRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (wheelRef.current) {
      const time = state.clock.getElapsedTime();
      wheelRef.current.rotation.z = Math.sin(time * 0.5) * 0.6;
    }
  });

  return (
    <group position={position} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {/* Main vault steel casing structure */}
      <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.84, 0.88, 0.84]} />
        <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.2} />
      </mesh>

      {/* Outer framing bevel */}
      <mesh position={[0, 0.44, 0.422]} castShadow>
        <boxGeometry args={[0.72, 0.76, 0.03]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} />
      </mesh>

      {/* Rotating shiny safe lock wheel dial */}
    </group>
  );
}

// Subcomponent: Glowing Stock Crypt-cube Pedestal (used inside Stocks mat)
function StockPedestal({ position, label, glowColor, labelOffset = 0.5 }: { position: [number, number, number], label: string, glowColor: string, labelOffset?: number }) {
  const crystalRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (crystalRef.current) {
      const time = state.clock.getElapsedTime();
      // Subtle float up and down motion
      crystalRef.current.position.y = 0.15 + Math.sin(time * 2.5 + label.charCodeAt(0)) * 0.02;
      crystalRef.current.rotation.y = time * 0.3;
    }
  });

  return (
    <group position={position}>
      {/* Dark elevated slate rim */}
      <mesh position={[0, 0.04, 0]} castShadow>
        <boxGeometry args={[0.38, 0.06, 0.38]} />
        <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.3} />
      </mesh>
      
      {/* Light cylinder base */}
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.12, 0.14, 0.04, 8]} />
        <meshStandardMaterial color="#475569" metalness={0.6} />
      </mesh>

      {/* Floating glowing transparent neon stock cube */}
      <mesh ref={crystalRef} position={[0, 0.15, 0]} castShadow>
        <boxGeometry args={[0.18, 0.16, 0.18]} />
        <meshStandardMaterial 
          color={glowColor} 
          emissive={glowColor} 
          emissiveIntensity={1.1} 
          transparent 
          opacity={0.82} 
          roughness={0.15} 
          metalness={0.2}
        />
      </mesh>
    </group>
  );
}

// Stocks trading zone rectangular carbon platform mat (Plain carpet rug, non-selectable)
function StocksPlatform({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Blue slate carpet mat base expanded for our luxurious couch group square */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} receiveShadow>
        <planeGeometry args={[2.8, 3.4]} />
        <meshStandardMaterial color="#1a2536" roughness={0.8} /> {/* matching deep-navy color of standard stock layouts */}
      </mesh>
      
      {/* Framed borders around the mat */}
      <mesh position={[0, 0.015, 1.7]} castShadow>
        <boxGeometry args={[2.82, 0.015, 0.04]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh position={[0, 0.015, -1.7]} castShadow>
        <boxGeometry args={[2.82, 0.015, 0.04]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh position={[1.4, 0.015, 0]} castShadow>
        <boxGeometry args={[0.04, 0.015, 3.4]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh position={[-1.4, 0.015, 0]} castShadow>
        <boxGeometry args={[0.04, 0.015, 3.4]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
    </group>
  );
}

// Subcomponent: Modern Voxel Comfort Sofa
function VoxelSofa({ position, rotation = 0, color = "#ea580c" }: { position: [number, number, number], rotation?: number, color?: string }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* 1. Base wood frame raised slightly above the carpet */}
      <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.7, 0.14, 1.65]} />
        <meshStandardMaterial color="#2d1502" roughness={0.8} /> {/* Dark walnut wooden base */}
      </mesh>

      {/* 2. Soft seat cushion */}
      <mesh position={[0.04, 0.22, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.62, 0.15, 1.55]} />
        <meshStandardMaterial color={color} roughness={0.6} /> {/* Comfortable fabric */}
      </mesh>

      {/* 3. Cosy Backrest */}
      <mesh position={[-0.26, 0.48, 0]} castShadow>
        <boxGeometry args={[0.18, 0.45, 1.55]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>

      {/* 4. Left Armrest */}
      <mesh position={[0.04, 0.32, -0.77]} castShadow>
        <boxGeometry args={[0.62, 0.3, 0.12]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>

      {/* 5. Right Armrest */}
      <mesh position={[0.04, 0.32, 0.77]} castShadow>
        <boxGeometry args={[0.62, 0.3, 0.12]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>

      {/* Minimalist metal feet details */}
      <mesh position={[-0.28, 0.012, -0.74]} castShadow>
        <boxGeometry args={[0.06, 0.04, 0.06]} />
        <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0.28, 0.012, -0.74]} castShadow>
        <boxGeometry args={[0.06, 0.04, 0.06]} />
        <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[-0.28, 0.012, 0.74]} castShadow>
        <boxGeometry args={[0.06, 0.04, 0.06]} />
        <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0.28, 0.012, 0.74]} castShadow>
        <boxGeometry args={[0.06, 0.04, 0.06]} />
        <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  );
}

// Subcomponent: High Quality Voxel Gaming Station with a flat-screen TV & game console
function VoxelGamingStation({ position }: { position: [number, number, number] }) {
  const powerLightRef = useRef<THREE.PointLight>(null);
  const screenMaterialRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    // Flicker rate matching intense video gameplay action bursts
    const intensity = 0.9 + Math.sin(time * 9.0) * 0.15 + Math.sin(time * 24.0) * 0.06;
    if (powerLightRef.current) {
      powerLightRef.current.intensity = intensity * 1.5;
    }
    if (screenMaterialRef.current) {
      screenMaterialRef.current.emissiveIntensity = intensity * 1.6;
    }
  });

  return (
    <group position={position} rotation={[0, -Math.PI / 2, 0]}>
      {/* 1. Low profile wooden/charcoal media console table */}
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.36, 0.44]} />
        <meshStandardMaterial color="#2d1502" roughness={0.8} /> {/* Match dark walnut tone */}
      </mesh>
      
      {/* TV Console Shelf cutout */}
      <mesh position={[0, 0.14, 0.02]} castShadow>
        <boxGeometry args={[1.3, 0.12, 0.40]} />
        <meshStandardMaterial color="#0c0a09" roughness={0.9} />
      </mesh>

      {/* 2. Micro Video Game Console (PS5-like white shell console) */}
      <group position={[-0.3, 0.39, 0.04]}>
        <mesh castShadow>
          <boxGeometry args={[0.07, 0.16, 0.14]} />
          <meshStandardMaterial color="#18181b" roughness={0.5} />
        </mesh>
        <mesh position={[-0.04, 0, 0]} castShadow>
          <boxGeometry args={[0.012, 0.18, 0.16]} />
          <meshStandardMaterial color="#f4f4f5" roughness={0.2} />
        </mesh>
        <mesh position={[0.04, 0, 0]} castShadow>
          <boxGeometry args={[0.012, 0.18, 0.16]} />
          <meshStandardMaterial color="#f4f4f5" roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.03, 0.072]}>
          <boxGeometry args={[0.02, 0.01, 0.01]} />
          <meshBasicMaterial color="#3b82f6" />
        </mesh>
      </group>

      {/* 3. Television Screen Mount / Pedestal */}
      <mesh position={[0, 0.44, 0]} castShadow>
        <boxGeometry args={[0.20, 0.10, 0.16]} />
        <meshStandardMaterial color="#1f2937" metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[0, 0.62, 0]} castShadow>
        <boxGeometry args={[0.06, 0.34, 0.06]} />
        <meshStandardMaterial color="#1f2937" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* 4. Large TV Screen Bezel */}
      <group position={[0, 1.12, 0.0]}>
        {/* The Frame Bezel */}
        <mesh castShadow>
          <boxGeometry args={[1.42, 0.82, 0.06]} />
          <meshStandardMaterial color="#030712" roughness={0.3} />
        </mesh>

        {/* Back panel projection */}
        <mesh position={[0, 0, -0.04]}>
          <boxGeometry args={[1.34, 0.74, 0.02]} />
          <meshStandardMaterial color="#111827" />
        </mesh>

        {/* Dynamic Display Face */}
        <mesh position={[0, 0, 0.031]} castShadow>
          <boxGeometry args={[1.36, 0.76, 0.01]} />
          <meshStandardMaterial 
            ref={screenMaterialRef}
            color="#0f172a" 
            emissive="#1d4ed8" 
            emissiveIntensity={1.3} 
            roughness={0.1} 
          />
        </mesh>

        {/* Pixels and HUD detailing an active gaming screen (Racing Game visualization) */}
        {/* Sky/Distant background (Vibrant Purplish Blue) */}
        <mesh position={[0, 0.18, 0.036]}>
          <boxGeometry args={[1.32, 0.36, 0.002]} />
          <meshBasicMaterial color="#1e1b4b" />
        </mesh>
        
        {/* Neon City skyline elements */}
        <mesh position={[-0.4, 0.12, 0.037]}>
          <boxGeometry args={[0.15, 0.20, 0.003]} />
          <meshBasicMaterial color="#4c1d95" />
        </mesh>
        <mesh position={[-0.15, 0.08, 0.037]}>
          <boxGeometry args={[0.22, 0.14, 0.003]} />
          <meshBasicMaterial color="#581c87" />
        </mesh>
        <mesh position={[0.3, 0.15, 0.037]}>
          <boxGeometry args={[0.18, 0.24, 0.003]} />
          <meshBasicMaterial color="#4c1d95" />
        </mesh>

        {/* Retro style pixel racetrack ground (Cyberpunk Magenta) */}
        <mesh position={[0, -0.22, 0.036]}>
          <boxGeometry args={[1.32, 0.44, 0.002]} />
          <meshBasicMaterial color="#db2777" />
        </mesh>
        {/* Perspective racetrack lines */}
        <mesh position={[0, -0.22, 0.037]} rotation={[0, 0, -0.2]}>
          <boxGeometry args={[0.04, 0.48, 0.003]} />
          <meshBasicMaterial color="#00ffff" />
        </mesh>
        <mesh position={[-0.3, -0.22, 0.037]} rotation={[0, 0, 0.35]}>
          <boxGeometry args={[0.04, 0.48, 0.003]} />
          <meshBasicMaterial color="#00ffff" />
        </mesh>
        <mesh position={[0.3, -0.22, 0.037]} rotation={[0, 0, -0.35]}>
          <boxGeometry args={[0.04, 0.48, 0.003]} />
          <meshBasicMaterial color="#00ffff" />
        </mesh>
        
        {/* Yellow cyber racing car / retro player sprite */}
        <mesh position={[-0.05, -0.24, 0.040]}>
          <boxGeometry args={[0.16, 0.09, 0.004]} />
          <meshBasicMaterial color="#facc15" />
        </mesh>
        {/* Blue wheels */}
        <mesh position={[-0.11, -0.28, 0.041]}>
          <boxGeometry args={[0.03, 0.02, 0.005]} />
          <meshBasicMaterial color="#06b6d4" />
        </mesh>
        <mesh position={[0.01, -0.28, 0.041]}>
          <boxGeometry args={[0.03, 0.02, 0.005]} />
          <meshBasicMaterial color="#06b6d4" />
        </mesh>

        {/* Glowing cyber cyan/magenta neon HUD text and score metrics */}
        <mesh position={[-0.45, 0.30, 0.038]}>
          <boxGeometry args={[0.26, 0.04, 0.002]} />
          <meshBasicMaterial color="#10b981" /> {/* Cyan health/shield bar */}
        </mesh>
        <mesh position={[0.45, 0.30, 0.038]}>
          <boxGeometry args={[0.22, 0.04, 0.002]} />
          <meshBasicMaterial color="#f43f5e" /> {/* Pink boost bar */}
        </mesh>
        <mesh position={[0, 0.32, 0.038]}>
          <boxGeometry args={[0.18, 0.06, 0.001]} />
          <meshBasicMaterial color="#ffffff" /> {/* Score field */}
        </mesh>
        {/* Neon green speed display indicator */}
        <mesh position={[0.42, -0.26, 0.038]}>
          <boxGeometry args={[0.12, 0.08, 0.001]} />
          <meshBasicMaterial color="#22c55e" />
        </mesh>

        {/* Flickering ambient room glow cast back onto players */}
        <pointLight 
          ref={powerLightRef}
          position={[0, 0.1, 0.5]} 
          color="#1e40af" 
          distance={4.0} 
          intensity={1.5} 
        />
      </group>
    </group>
  );
}

// Alternate smaller front-left mat (Gold stack, blue FII, blue block)
function FrontLeftGoldPlatform({ position, onSelect, isSelected }: { position: [number, number, number], onSelect: () => void, isSelected: boolean }) {
  return (
    <group position={position} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {/* mat base pane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} receiveShadow>
        <planeGeometry args={[1.6, 1.6]} />
        <meshStandardMaterial color="#0f172a" roughness={0.7} />
      </mesh>

      {/* A. Gold bars pile */}
      <group position={[-0.35, 0, -0.3]}>
        <mesh position={[-0.1, 0.04, 0]} castShadow>
          <boxGeometry args={[0.2, 0.07, 0.11]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.15} />
        </mesh>
        <mesh position={[0.1, 0.04, 0]} castShadow>
          <boxGeometry args={[0.2, 0.07, 0.11]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.15} />
        </mesh>
        <mesh position={[0, 0.09, 0]} castShadow>
          <boxGeometry args={[0.2, 0.07, 0.11]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.15} />
        </mesh>
      </group>

      {/* B. Blue crystal item labeled FII */}
      <group position={[0.35, 0, -0.2]}>
        <mesh position={[0, 0.04, 0]} castShadow>
          <boxGeometry args={[0.26, 0.05, 0.26]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
        <mesh position={[0, 0.12, 0]} castShadow>
          <boxGeometry args={[0.15, 0.13, 0.15]} />
          <meshStandardMaterial color="#06b6d4" emissive="#0891b2" emissiveIntensity={0.6} transparent opacity={0.88} />
        </mesh>
      </group>

      {/* C. Cute glowing pink block with pig details labeled PET1 */}
      <group position={[-0.05, 0, 0.35]}>
        <mesh position={[0, 0.04, 0]} castShadow>
          <boxGeometry args={[0.26, 0.05, 0.26]} />
          <meshStandardMaterial color="#ec4899" />
        </mesh>
        <mesh position={[0, 0.12, 0]} castShadow>
          <boxGeometry args={[0.16, 0.13, 0.16]} />
          <meshStandardMaterial color="#f472b6" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.10, 0.08]} castShadow>
          <boxGeometry args={[0.06, 0.04, 0.02]} />
          <meshStandardMaterial color="#db2777" />
        </mesh>
      </group>
    </group>
  );
}

// Subcomponent: Modern Wooden PC Desk setup (with chair behind it)
function OfficeDesk({ position, rotation = 0, chairColor = "#7c3aed" }: { position: [number, number, number], rotation?: number, chairColor?: string }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Tabletop */}
      <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 0.05, 0.52]} />
        <meshStandardMaterial color="#d97706" roughness={0.7} /> {/* beautiful real wood color */}
      </mesh>

      {/* Slim black legs */}
      <mesh position={[-0.45, 0.17, -0.22]} castShadow>
        <boxGeometry args={[0.04, 0.32, 0.04]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[0.45, 0.17, -0.22]} castShadow>
        <boxGeometry args={[0.04, 0.32, 0.04]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[-0.45, 0.17, 0.22]} castShadow>
        <boxGeometry args={[0.04, 0.32, 0.04]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[0.45, 0.17, 0.22]} castShadow>
        <boxGeometry args={[0.04, 0.32, 0.04]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>

      {/* Screen Monitor */}
      <group position={[0, 0.44, -0.1]}>
        {/* Base */}
        <mesh position={[0, -0.04, 0]}>
          <boxGeometry args={[0.14, 0.01, 0.1]} />
          <meshStandardMaterial color="#475569" />
        </mesh>
        {/* Column stand */}
        <mesh position={[0, 0.02, -0.03]}>
          <boxGeometry args={[0.02, 0.12, 0.02]} />
          <meshStandardMaterial color="#475569" />
        </mesh>
        {/* Screen board */}
        <mesh position={[0, 0.08, -0.015]} castShadow>
          <boxGeometry args={[0.34, 0.18, 0.015]} />
          <meshStandardMaterial color="#0f172a" roughness={0.3} />
        </mesh>
        {/* Glowing display texture */}
        <mesh position={[0, 0.08, -0.005]}>
          <boxGeometry args={[0.31, 0.15, 0.005]} />
          <meshStandardMaterial color="#0284c7" emissive="#0ea5e9" emissiveIntensity={0.3} roughness={0.2} />
        </mesh>
      </group>

      {/* Keyboard panel */}
      <mesh position={[0, 0.38, 0.08]} castShadow>
        <boxGeometry args={[0.26, 0.01, 0.08]} />
        <meshStandardMaterial color="#334155" />
      </mesh>

      {/* Swivel Office Chair */}
      <group position={[0, 0, 0.52]} rotation={[0, Math.PI, 0]}>
        {/* Base wheels structure star */}
        <mesh position={[0, 0.03, 0]}>
          <boxGeometry args={[0.34, 0.02, 0.03]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
        <mesh position={[0, 0.03, 0]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[0.34, 0.02, 0.03]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
        {/* Chrome support cylinder */}
        <mesh position={[0, 0.13, 0]} castShadow>
          <cylinderGeometry args={[0.02, 0.02, 0.18, 8]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Seat cushion */}
        <mesh position={[0, 0.23, 0]} castShadow>
          <boxGeometry args={[0.3, 0.04, 0.28]} />
          <meshStandardMaterial color={chairColor} roughness={0.7} />
        </mesh>
        {/* Backrest rod support */}
        <mesh position={[0, 0.32, -0.11]} castShadow>
          <boxGeometry args={[0.04, 0.15, 0.03]} />
          <meshStandardMaterial color="#475569" metalness={0.7} />
        </mesh>
        {/* Backrest cushion */}
        <mesh position={[0, 0.44, -0.12]} rotation={[0.05, 0, 0]} castShadow>
          <boxGeometry args={[0.28, 0.22, 0.034]} />
          <meshStandardMaterial color={chairColor} roughness={0.7} />
        </mesh>
      </group>
    </group>
  );
}

// Subcomponent: Modern Animated Voxel Refrigerator with beautiful opening swing, food shelves, and internal LED glow
function VoxelRefrigerator({ isOpen }: { isOpen: boolean }) {
  const doorRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(() => {
    if (doorRef.current) {
      const targetRotation = isOpen ? -Math.PI / 2 : 0;
      doorRef.current.rotation.y = THREE.MathUtils.lerp(
        doorRef.current.rotation.y,
        targetRotation,
        0.12
      );
    }

    if (lightRef.current) {
      const targetIntensity = isOpen ? 12.0 : 0.0;
      lightRef.current.intensity = THREE.MathUtils.lerp(
        lightRef.current.intensity,
        targetIntensity,
        0.12
      );
    }
  });

  return (
    <group position={[-4.6, 0, -4.6]}>
      {/* Hollow Refrigerator Body */}
      {/* Back Plate */}
      <mesh position={[0, 0.85, -0.28]} castShadow receiveShadow>
        <boxGeometry args={[0.58, 1.7, 0.05]} />
        <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Left Wall Plate */}
      <mesh position={[-0.285, 0.85, 0.01]} castShadow receiveShadow>
        <boxGeometry args={[0.05, 1.7, 0.53]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.2} />
      </mesh>
      {/* Right Wall Plate */}
      <mesh position={[0.285, 0.85, 0.01]} castShadow receiveShadow>
        <boxGeometry args={[0.05, 1.7, 0.53]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.2} />
      </mesh>
      {/* Top Plate */}
      <mesh position={[0, 1.675, 0.01]} castShadow receiveShadow>
        <boxGeometry args={[0.62, 0.05, 0.53]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.2} />
      </mesh>
      {/* Bottom Plate */}
      <mesh position={[0, 0.025, 0.01]} castShadow receiveShadow>
        <boxGeometry args={[0.62, 0.05, 0.53]} />
        <meshStandardMaterial color="#64748b" metalness={0.5} roughness={0.4} />
      </mesh>

      {/* Internal Shelves & Foods */}
      {/* Shelf 1 (Low) */}
      <mesh position={[0, 0.45, 0.0]} receiveShadow>
        <boxGeometry args={[0.5, 0.02, 0.48]} />
        <meshStandardMaterial color="#e2e8f0" transparent opacity={0.6} roughness={0.1} />
      </mesh>
      {/* Large Pizza Box in low shelf */}
      <mesh position={[0.02, 0.485, -0.04]} castShadow>
        <boxGeometry args={[0.34, 0.04, 0.34]} />
        <meshStandardMaterial color="#fca5a5" roughness={0.8} />
      </mesh>
      {/* Small sticker decoration on center of pizza box */}
      <mesh position={[0.02, 0.51, -0.04]}>
        <boxGeometry args={[0.1, 0.005, 0.1]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>

      {/* Shelf 2 (Middle) */}
      <mesh position={[0, 0.9, 0.0]} receiveShadow>
        <boxGeometry args={[0.5, 0.02, 0.48]} />
        <meshStandardMaterial color="#e2e8f0" transparent opacity={0.6} roughness={0.1} />
      </mesh>
      {/* Food Items: Soda cans & Energy drink boxes on Middle Shelf */}
      <mesh position={[-0.14, 0.98, -0.1]} castShadow>
        <boxGeometry args={[0.06, 0.12, 0.06]} />
        <meshStandardMaterial color="#ef4444" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[-0.05, 0.98, -0.1]} castShadow>
        <boxGeometry args={[0.06, 0.12, 0.06]} />
        <meshStandardMaterial color="#22c55e" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0.04, 0.98, -0.12]} castShadow>
        <boxGeometry args={[0.06, 0.12, 0.06]} />
        <meshStandardMaterial color="#0ea5e9" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Milk Carton next to them */}
      <mesh position={[0.15, 1.01, -0.04]} castShadow>
        <boxGeometry args={[0.09, 0.2, 0.09]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.6} />
      </mesh>
      {/* Milk Carton top slope fold */}
      <mesh position={[0.15, 1.12, -0.04]} rotation={[Math.PI / 4, 0, 0]}>
        <boxGeometry args={[0.09, 0.03, 0.09]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>
      
      {/* Shelf 3 (High) */}
      <mesh position={[0, 1.3, 0.0]} receiveShadow>
        <boxGeometry args={[0.5, 0.02, 0.48]} />
        <meshStandardMaterial color="#e2e8f0" transparent opacity={0.6} roughness={0.1} />
      </mesh>
      {/* Some Apples or Oranges */}
      <mesh position={[-0.12, 1.35, -0.08]} castShadow>
        <sphereGeometry args={[0.034, 8, 8]} />
        <meshStandardMaterial color="#ef4444" roughness={0.4} />
      </mesh>
      <mesh position={[-0.05, 1.35, -0.05]} castShadow>
        <sphereGeometry args={[0.034, 8, 8]} />
        <meshStandardMaterial color="#eab308" roughness={0.5} />
      </mesh>
      <mesh position={[-0.1, 1.35, -0.01]} castShadow>
        <sphereGeometry args={[0.034, 8, 8]} />
        <meshStandardMaterial color="#22c55e" roughness={0.4} />
      </mesh>

      {/* Internal food box */}
      <mesh position={[0.12, 1.36, -0.06]} castShadow>
        <boxGeometry args={[0.14, 0.1, 0.18]} />
        <meshStandardMaterial color="#d97706" roughness={0.8} />
      </mesh>

      {/* Internal Blue LED Glow light */}
      <pointLight ref={lightRef} position={[0, 1.4, 0.15]} intensity={0} distance={1.8} color="#e0f2fe" />

      {/* The Door Group hinged on left corner: X = -0.31, Z = 0.28 */}
      <group ref={doorRef} position={[-0.31, 0, 0.28]}>
        <group position={[0.31, 0, 0]}>
          {/* Main Door Panel */}
          <mesh position={[0, 0.85, 0.02]} castShadow>
            <boxGeometry args={[0.62, 1.7, 0.04]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.2} />
          </mesh>

          {/* Door seal trim */}
          <mesh position={[0, 0.85, -0.005]}>
            <boxGeometry args={[0.58, 1.66, 0.01]} />
            <meshStandardMaterial color="#1e293b" roughness={0.9} />
          </mesh>

          {/* Vertical black handle */}
          <mesh position={[0.26, 1.0, 0.06]} castShadow>
            <boxGeometry args={[0.04, 0.6, 0.04]} />
            <meshStandardMaterial color="#334155" roughness={0.4} />
          </mesh>
          <mesh position={[0.26, 1.28, 0.04]} castShadow>
            <boxGeometry args={[0.04, 0.02, 0.03]} />
            <meshStandardMaterial color="#334155" roughness={0.4} />
          </mesh>
          <mesh position={[0.26, 0.72, 0.04]} castShadow>
            <boxGeometry args={[0.04, 0.02, 0.03]} />
            <meshStandardMaterial color="#334155" roughness={0.4} />
          </mesh>

          {/* Refrigerator Smart Screen Detail */}
          <mesh position={[0.1, 1.25, 0.045]}>
            <boxGeometry args={[0.18, 0.12, 0.01]} />
            <meshStandardMaterial color="#020617" emissive="#0ea5e9" emissiveIntensity={0.6} />
          </mesh>
          <mesh position={[0.1, 1.25, 0.051]}>
            <boxGeometry args={[0.15, 0.01, 0.001]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
          <mesh position={[0.1, 1.21, 0.051]}>
            <boxGeometry args={[0.08, 0.01, 0.001]} />
            <meshBasicMaterial color="#10b981" />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// Inner canvas logic
interface Spot {
  id: string;
  state: "work" | "sofa" | "walk" | "pool" | "fridge" | "coffee" | "water";
  x: number;
  z: number;
  sitRotate?: number;
}

// 21 discrete semantic slots covering the whole office environment perfectly
const SPOT_TEMPLATES: Spot[] = [
  // Computer Workspace Desks (4 Desks forming a Quad island)
  { id: "desk_0", state: "work", x: -3.95, z: 4.07, sitRotate: Math.PI },
  { id: "desk_1", state: "work", x: -2.75, z: 4.07, sitRotate: Math.PI },
  { id: "desk_2", state: "work", x: -3.95, z: 2.43, sitRotate: 0 },
  { id: "desk_3", state: "work", x: -2.75, z: 2.43, sitRotate: 0 },

  // Sofas (3 Large sofas forming a square group, fits up to 9 people)
  // West Sofa (rotation 0, faces East)
  { id: "sofa_west_0", state: "sofa", x: -3.5, z: -1.5, sitRotate: Math.PI / 2 },
  { id: "sofa_west_1", state: "sofa", x: -3.5, z: -1.0, sitRotate: Math.PI / 2 },
  { id: "sofa_west_2", state: "sofa", x: -3.5, z: -0.5, sitRotate: Math.PI / 2 },
  // North Sofa (rotation -Math.PI / 2, faces South)
  { id: "sofa_north_0", state: "sofa", x: -2.9, z: -2.1, sitRotate: 0 },
  { id: "sofa_north_1", state: "sofa", x: -2.4, z: -2.1, sitRotate: 0 },
  { id: "sofa_north_2", state: "sofa", x: -1.9, z: -2.1, sitRotate: 0 },
  // South Sofa (rotation Math.PI / 2, faces North)
  { id: "sofa_south_0", state: "sofa", x: -2.9, z: 0.1, sitRotate: Math.PI },
  { id: "sofa_south_1", state: "sofa", x: -2.4, z: 0.1, sitRotate: Math.PI },
  { id: "sofa_south_2", state: "sofa", x: -1.9, z: 0.1, sitRotate: Math.PI },

  // Pool Nodes near MiniPiscina (Back Right)
  { id: "pool_0", state: "pool", x: 3.3, z: -3.3 },
  { id: "pool_1", state: "pool", x: 3.9, z: -3.3 },
  { id: "pool_2", state: "pool", x: 3.3, z: -3.9 },
  { id: "pool_3", state: "pool", x: 3.9, z: -3.9 },

  // Office Break Facilities (Capacity 1 each)
  { id: "fridge", state: "fridge", x: -4.3, z: -3.9, sitRotate: Math.PI },
  { id: "coffee", state: "coffee", x: -3.0, z: -3.9 },
  { id: "water", state: "water", x: -1.7, z: -3.9 },

  // Safe fallback walk nodes (positioned explicitly near the walls to completely avoid the center corridor)
  { id: "walk_gen_0", state: "walk", x: 1.8, z: 3.5 },
  { id: "walk_gen_1", state: "walk", x: -1.5, z: 1.5 },
  { id: "walk_gen_2", state: "walk", x: 3.8, z: 1.0 },
  { id: "walk_gen_3", state: "walk", x: -1.0, z: -3.8 }
];

// Helper to query and reserve an exclusive unoccupied spot for an agent
function getUnoccupiedSpot(
  preferredState: "work" | "sofa" | "walk" | "pool" | "fridge" | "coffee" | "water",
  occupiedSpotIds: Set<string>,
  isLoss: boolean = false
): Spot {
  let targetState = preferredState;

  // Helper inside to count how many current spot reservations meet a specific state
  const getOccupiedCount = (stateName: string) => {
    let count = 0;
    occupiedSpotIds.forEach((id) => {
      const template = SPOT_TEMPLATES.find((s) => s.id === id);
      if (template && template.state === stateName) {
        count++;
      }
    });
    return count;
  };

  // If the agent is in a loss, they are forbidden from working! They will randomly choose among leisure states.
  if (isLoss && targetState === "work") {
    const leisureChoices: ("sofa" | "pool" | "fridge" | "coffee" | "water")[] = ["sofa", "pool", "fridge", "coffee", "water"];
    targetState = leisureChoices[Math.floor(Math.random() * leisureChoices.length)];
  }

  // Filter templates excluding work if they are in loss, and enforcing a strict capacity limit of 2 for sofa and pool
  const allowedTemplates = SPOT_TEMPLATES.filter((s) => {
    // Cannot select an already occupied exact spot
    if (occupiedSpotIds.has(s.id)) return false;

    // Disallowed to work if suffering a loss
    if (isLoss && s.state === "work") return false;

    // Strict state capacity limit (maximum 8 allowed on sofas since we have 3 huge 3-seater sofas)
    if (s.state === "sofa" && getOccupiedCount("sofa") >= 8) return false;
    if (s.state === "pool" && getOccupiedCount("pool") >= 3) return false;

    // strict physical spacing (minimum 1.35 meters/units) to completely eliminate overlapping near sofas or any other clustered zones
    const occupiedSpots = SPOT_TEMPLATES.filter((st) => occupiedSpotIds.has(st.id));
    for (const occ of occupiedSpots) {
      const dx = s.x - occ.x;
      const dz = s.z - occ.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 1.35) {
        // Exempt if both are pool nodes, both are sofa nodes, or both are work nodes
        const exempt =
          (s.state === "pool" && occ.state === "pool") ||
          (s.state === "sofa" && occ.state === "sofa") ||
          (s.state === "work" && occ.state === "work");
        if (!exempt) {
          return false;
        }
      }
    }

    return true;
  });

  // 1. Filter candidates for the preferred state
  const candidates = allowedTemplates.filter(
    (s) => s.state === targetState
  );

  if (candidates.length > 0) {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  // 2. Fallbacks if chosen facility/state is busy or at maximum capacity
  const walkCandidates = allowedTemplates.filter((s) => s.state === "walk");
  if (walkCandidates.length > 0) {
    return walkCandidates[Math.floor(Math.random() * walkCandidates.length)];
  }

  // 3. Absolute fallback: any unoccupied spot in the office conforming to capacities
  const anyUnoccupied = allowedTemplates;
  if (anyUnoccupied.length > 0) {
    return anyUnoccupied[Math.floor(Math.random() * anyUnoccupied.length)];
  }

  // 4. Default: fallback to general walk node so they keep circulating neatly
  const generalWalkNode = SPOT_TEMPLATES.find((s) => s.id === "walk_gen_0") || SPOT_TEMPLATES[5];
  return generalWalkNode;
}

const THOUGHTS_BY_STATE: Record<string, string[]> = {
  work: [
    "Codando correções de liquidez... 💻",
    "Estabilizando taxas de juros do CDB! ⚡",
    "Monitorando spreads de arbitragem... 📊",
    "Acompanhando o book de ofertas de perto! 👀💰",
    "Otimizando a precisão do algoritmo quantitativo... 🧠",
  ],
  sofa: [
    "Dando uma pausa estratégica no sofá... 🔋",
    "Sofá corporativo confortável recarrega tudo! 🛋️💤",
    "Relaxando os neurônios após intensa rodada comercial! ✨",
  ],
  talk: [
    "Você viu a volatilidade desse ativo hoje? Incrível! 🗣️",
    "Acho que o suporte de preço ali está fortíssimo! 📈",
    "Novidades no setor financeiro prometem ótimos lucros! 🤝",
    "Alinhando novas métricas de crescimento com a equipe. 📊",
    "Parcerias estratégicas aceleram qualquer portfólio! 💎",
  ],
  walk: [
    "Caminhada estratégica limpa a mente... 🚶",
    "O segredo do holder é manter a mente calma! ✨",
    "Pensando em rebalanceamento e novos dividendos... 💸",
  ],
  pool: [
    "Mergulhando de cabeça nos lucros crescentes! 🏊🌊",
    "Que piscina confortável, alivia as volatilidades! 🏄",
    "Flutuando com maestria pelas ondas descentralizadas! 🏖️",
  ],
  fridge: [
    "Hora daquele lanche corporativo maravilhoso! 🍕❤️",
    "Lanchinho bem gelado melhora o dia! 🍩🥛",
    "Saciando a fome com as melhores snacks do escritório! 🍎🍪",
  ],
  coffee: [
    "O verdadeiro combustível do trader moderno! ☕⚡",
    "Café sagrado para manter atenção a cada tick! ☕✨",
    "Double expresso ativo! Energia restaurada! 🔋🔥",
  ],
  water: [
    "Hidratação constante evita decisões precipitadas! 💧",
    "Mente saudável precisa de corpo super hidratado! 🥤✨",
    "Água fresquinha pra clarear as ideias no mercado! 🧊",
  ],
  stretch: [
    "Alongando as costas pra evitar fadiga postureira! 🙆‍♂️",
    "Postura retinha, auditar transações com rigor! 🤸",
  ],
  celebrate: [
    "ALTO RENDIMENTO! Vitória total nas operações! 🚀🏆",
    "To the moon! Esse ativo disparou absurdo! 📈💥",
  ]
};

const SAD_THOUGHTS: string[] = [
  "Ah não, esse gráfico vermelho está de chorar... 📉🥺",
  "Ativo com perdas... Não posso usar o computador de trabalho! 🚫💻",
  "Poxa, ativo caiu, preciso de um cafézinho pra me confortar. ☕💔",
  "Esperando a maré vermelha passar no relaxamento... 🛋️⏳",
  "Ativos negativos sob análise de risco estratégica! 📉🔍",
];

function getAgentPersonality(name: string, role: string, index: number): "workaholic" | "gamer" | "swimmer" | "socializer" | "chill" {
  let hash = 0;
  const str = name + role;
  for (let i = 0; i < str.length; i++) {
    hash += str.charCodeAt(i);
  }
  const indexVal = (hash + index) % 5;
  const types: Array<"workaholic" | "gamer" | "swimmer" | "socializer" | "chill"> = ["workaholic", "gamer", "swimmer", "socializer", "chill"];
  return types[indexVal];
}

function getPreferredStateForPersonality(
  personality: "workaholic" | "gamer" | "swimmer" | "socializer" | "chill",
  isLoss: boolean
): "work" | "sofa" | "walk" | "pool" | "fridge" | "coffee" | "water" {
  const roll = Math.random();

  // If the character has a positive performance (isLoss is false), they focus heavily on computer work!
  if (!isLoss) {
    if (roll < 0.85) {
      return "work";
    }
    const leisureChoices: ("sofa" | "coffee" | "water")[] = ["sofa", "coffee", "water"];
    return leisureChoices[Math.floor(Math.random() * leisureChoices.length)];
  }

  // If isLoss is true, they are forbidden from computer work. They do leisure / breakroom activities.
  if (personality === "workaholic") {
    if (roll < 0.50) return "sofa";
    if (roll < 0.80) return "coffee";
    return "pool";
  }

  if (personality === "gamer") {
    if (roll < 0.70) return "sofa";
    if (roll < 0.90) return "pool";
    return "fridge";
  }

  if (personality === "swimmer") {
    if (roll < 0.70) return "pool";
    if (roll < 0.90) return "sofa";
    return "water";
  }

  if (personality === "socializer") {
    if (roll < 0.60) return "sofa";
    if (roll < 0.75) return "coffee";
    if (roll < 0.90) return "water";
    return "pool";
  }

  // chill default
  if (roll < 0.35) return "sofa";
  if (roll < 0.55) return "fridge";
  if (roll < 0.70) return "coffee";
  if (roll < 0.85) return "water";
  return "pool";
}

function getStateTimerForState(
  state: "work" | "sofa" | "walk" | "pool" | "fridge" | "coffee" | "water"
): number {
  switch (state) {
    case "work":
      return 60 + Math.floor(Math.random() * 50);
    case "sofa":
      return 65 + Math.floor(Math.random() * 55);
    case "pool":
      return 60 + Math.floor(Math.random() * 50);
    case "walk":
      return 35 + Math.floor(Math.random() * 25);
    case "fridge":
    case "coffee":
    case "water":
      return 25 + Math.floor(Math.random() * 20);
    default:
      return 30;
  }
}

// Inner canvas logic
function OfficeSceneContent({ agents: propAgents, portfolioStats, onSelectEntity, selectedEntity, onAgentsUpdate, isMarketOpen = true }: ThreeOfficeSceneProps) {
  const { size } = useThree();
  const targetY = useMemo(() => {
    const aspect = size.width / size.height;
    if (aspect < 1.1) {
      // Shifting target Y upwards centered the 3D room beautifully on high-aspect-ratio vertical viewports
      return 1.45;
    }
    return 0.4;
  }, [size.width, size.height]);

  // Maintain coordinates for up to 12 active Voxel Agents with decoupled start times and varied states
  const [agents, setAgents] = useState<AgentState[]>(() => {
    let savedAgentsList: AgentState[] = [];
    try {
      const saved = localStorage.getItem("finevo:office:simulated_agents_v2");
      if (saved) {
        savedAgentsList = JSON.parse(saved);
      }
    } catch (e) {
      console.warn("Failed to load saved agents from localStorage", e);
    }
    const savedMap = new Map((savedAgentsList || []).map((a) => [a.id, a]));

    const occupied = new Set<string>();
    // Pre-reserve positions of saved active agents to prevent collisions
    propAgents.forEach((agent) => {
      const saved = savedMap.get(agent.id);
      if (saved && saved.currentSpotId) {
        occupied.add(saved.currentSpotId);
      }
    });

    return propAgents.map((agent, i) => {
      if (savedMap.has(agent.id)) {
        const saved = savedMap.get(agent.id)!;
        return {
          ...agent,
          state: saved.state,
          stateTimer: saved.stateTimer,
          targetX: saved.targetX,
          targetZ: saved.targetZ,
          sitRotate: saved.sitRotate,
          x: saved.x !== undefined ? saved.x : saved.targetX,
          z: saved.z !== undefined ? saved.z : saved.targetZ,
          currentSpotId: saved.currentSpotId,
          energy: saved.energy !== undefined ? saved.energy : 100,
          satiety: saved.satiety !== undefined ? saved.satiety : 100,
          happiness: saved.happiness !== undefined ? saved.happiness : 100,
          thought: saved.thought || "Monitorando os dados operacionais 🚀",
          lifeStatus: saved.lifeStatus || "Ativo ✨",
          personality: saved.personality || getAgentPersonality(agent.name, agent.role, i),
        };
      }

      const isLoss = agent.variation < 0;
      const personality = getAgentPersonality(agent.name, agent.role, i);
      const preferredState = getPreferredStateForPersonality(personality, isLoss);

      const spot = getUnoccupiedSpot(preferredState, occupied, isLoss);
      occupied.add(spot.id);

      // Decouple starting time of agents beautifully so they don't migrate simultaneously
      const initialTimer = 25 + Math.floor(Math.random() * 55);
      const energy = Math.floor(65 + Math.random() * 30);
      const satiety = Math.floor(70 + Math.random() * 25);
      const happiness = isLoss ? Math.floor(30 + Math.random() * 20) : Math.floor(75 + Math.random() * 20);
      const thought = isLoss ? "Poxa, ativo vermelho de chatear... 📉" : "Estável e de olho nos lucros! 🚀";
      const lifeStatus = isLoss ? "Preocupado 📉" : "Ativo ✨";

      return {
        ...agent,
        state: spot.state,
        stateTimer: initialTimer,
        targetX: spot.x,
        targetZ: spot.z,
        sitRotate: spot.sitRotate,
        x: spot.x,
        z: spot.z,
        currentSpotId: spot.id,
        energy,
        satiety,
        happiness,
        thought,
        lifeStatus,
        personality,
      };
    });
  });

  // Synchronize local agents state with prop changes (additions/removals/variations) smoothly!
  useEffect(() => {
    setAgents((prev) => {
      const prevMap = new Map(prev.map((a) => [a.id, a]));
      const occupied = new Set<string>();

      // First reserve spot IDs from kept agents
      propAgents.forEach((pAgent) => {
        if (prevMap.has(pAgent.id)) {
          const existing = prevMap.get(pAgent.id)!;
          if (existing.currentSpotId) {
            occupied.add(existing.currentSpotId);
          }
        }
      });

      return propAgents.map((pAgent) => {
        if (prevMap.has(pAgent.id)) {
          const existing = prevMap.get(pAgent.id)!;
          const isNowLoss = pAgent.variation < 0;
          let state = existing.state;
          let targetX = existing.targetX;
          let targetZ = existing.targetZ;
          let sitRotate = existing.sitRotate;
          let currentSpotId = existing.currentSpotId;
          let stateTimer = existing.stateTimer;

          // If they just got dynamic negative performance during workspace activities, immediately evict them out to leisure spots!
          if (isNowLoss && state === "work") {
            const spot = getUnoccupiedSpot("sofa", occupied, true);
            occupied.add(spot.id);
            state = spot.state;
            targetX = spot.x;
            targetZ = spot.z;
            sitRotate = spot.sitRotate;
            currentSpotId = spot.id;
            stateTimer = 15 + Math.floor(Math.random() * 15);
          } else {
            if (currentSpotId) {
              occupied.add(currentSpotId);
            }
          }

          return {
            ...existing,
            name: pAgent.name,
            role: pAgent.role,
            variation: pAgent.variation,
            avatarColor: pAgent.avatarColor,
            suitColor: pAgent.suitColor,
            hairColor: pAgent.hairColor,
            accessory: pAgent.accessory,
            gender: pAgent.gender,
            state,
            targetX,
            targetZ,
            sitRotate,
            currentSpotId,
            stateTimer,
          };
        } else {
          // It's a newly added agent! Initialize them randomly
          const isLoss = pAgent.variation < 0;
          const personality = getAgentPersonality(pAgent.name, pAgent.role, propAgents.indexOf(pAgent));
          const preferredState = getPreferredStateForPersonality(personality, isLoss);

          const spot = getUnoccupiedSpot(preferredState, occupied, isLoss);
          occupied.add(spot.id);
          const initialTimer = 25 + Math.floor(Math.random() * 55);

          const energy = Math.floor(65 + Math.random() * 30);
          const satiety = Math.floor(70 + Math.random() * 25);
          const happiness = isLoss ? Math.floor(30 + Math.random() * 20) : Math.floor(75 + Math.random() * 20);
          const thought = isLoss ? "Poxa, as quedas me chatearam... 📉" : "Tudo pronto pra focar nos dividendos! 🚀";
          const lifeStatus = isLoss ? "Preocupado 📉" : "Ativo ✨";

          return {
            ...pAgent,
            state: spot.state,
            stateTimer: initialTimer,
            targetX: spot.x,
            targetZ: spot.z,
            sitRotate: spot.sitRotate,
            x: spot.x,
            z: spot.z,
            currentSpotId: spot.id,
            energy,
            satiety,
            happiness,
            thought,
            lifeStatus,
            personality,
          };
        }
      });
    });
  }, [propAgents]);

  // Keep track of which agent IDs are in close physical proximity to the refrigerator
  const [agentsNearFridge, setAgentsNearFridge] = useState<Set<string>>(new Set());

  const handleFridgeProximity = useCallback((agentId: string, isNear: boolean) => {
    setAgentsNearFridge((prev) => {
      const next = new Set(prev);
      if (isNear) {
        next.add(agentId);
      } else {
        next.delete(agentId);
      }
      return next;
    });
  }, []);

  // Center circle and desk coordinates
  const destinations = useMemo(() => {
    return {
      // Special visual nodes for stroller walk
      cdb_pool: [0, -3.2] as [number, number],
      stocks_grid: [-3.4, -1.0] as [number, number],
    };
  }, []);

  const centerPositionsList = useMemo(() => [
    [1.1, -0.3],
    [-0.4, 1.1],
    [1.1, 1.2],
    [0.3, 0.4],
    [0.0, 0.0],
    [-0.8, -0.2],
    [0.5, -0.8]
  ], []);

  // Notify parent of synced agents updates (for live bottom selected drawer reactive stats!)
  useEffect(() => {
    onAgentsUpdate?.(agents);
    try {
      localStorage.setItem("finevo:office:simulated_agents_v2", JSON.stringify(agents));
    } catch (e) {
      console.warn("Failed to save agents to localStorage", e);
    }
  }, [agents, onAgentsUpdate]);

  // Simulative routine cycles: toggling state between talk in center & visiting assets desks
  useEffect(() => {
    const intervals = setInterval(() => {
      setAgents((prev) => {
        // Collect currently occupied spot IDs for agents who are NOT timing out this tick
        const occupied = new Set<string>();
        prev.forEach((agent) => {
          if (agent.stateTimer - 1 > 0 && agent.currentSpotId) {
            occupied.add(agent.currentSpotId);
          }
        });

        return prev.map((agent) => {
          let nextTimer = agent.stateTimer - 1;
          let nextState = agent.state;
          let nextTX = agent.targetX;
          let nextTZ = agent.targetZ;
          let agentSitRotate = agent.sitRotate;
          let nextSpotId = agent.currentSpotId;

          const isLoss = agent.variation < 0;

          // Decay needs
          let currentEnergy = agent.energy ?? 100;
          let currentSatiety = agent.satiety ?? 100;
          let currentHappiness = agent.happiness ?? 100;

          // Slower decay rates matching 1-to-2 minute tasks beautifully
          if (agent.state === "work") {
            currentEnergy = Math.max(0, currentEnergy - 0.3);
            currentSatiety = Math.max(0, currentSatiety - 0.2);
          } else if (agent.state === "walk") {
            currentEnergy = Math.max(0, currentEnergy - 0.2);
            currentSatiety = Math.max(0, currentSatiety - 0.2);
          } else {
            currentEnergy = Math.max(0, currentEnergy - 0.1);
            currentSatiety = Math.max(0, currentSatiety - 0.1);
          }

          if (isLoss) {
            currentHappiness = Math.max(10, currentHappiness - 0.4);
          } else {
            if (agent.state === "pool" || agent.state === "sofa") {
              currentHappiness = Math.min(100, currentHappiness + 0.6);
            } else {
              currentHappiness = Math.max(20, currentHappiness - 0.05);
            }
          }

          // Replenish needs depending on active state gradually over their longer stay
          if (agent.state === "coffee") {
            currentEnergy = Math.min(100, currentEnergy + 1.5);
          } else if (agent.state === "sofa") {
            currentEnergy = Math.min(100, currentEnergy + 1.2);
          } else if (agent.state === "fridge") {
            currentSatiety = Math.min(100, currentSatiety + 2.0);
          } else if (agent.state === "water") {
            currentSatiety = Math.min(100, currentSatiety + 1.0);
            currentEnergy = Math.min(100, currentEnergy + 0.2);
          } else if (agent.state === "pool") {
            currentHappiness = Math.min(100, currentHappiness + 1.5);
          }

          // Crucial projection: If they are working but now we detect isLoss (negative variation),
          // or if they somehow fell into work state while having a loss, forcefully evict them immediately!
          if (isLoss && nextState === "work") {
            const spot = getUnoccupiedSpot("sofa", occupied, true);
            occupied.add(spot.id);
            nextState = spot.state;
            nextTX = spot.x;
            nextTZ = spot.z;
            agentSitRotate = spot.sitRotate;
            nextSpotId = spot.id;
            nextTimer = 45 + Math.floor(Math.random() * 35);
          }

          if (nextTimer <= 0) {
            const agencyPersonality = agent.personality || "chill";
            let preferredState: "work" | "sofa" | "walk" | "pool" | "fridge" | "coffee" | "water" = "work";

            // If a need is critically low and they want to change state, prioritize resolving that need!
            if (currentEnergy < 30) {
              preferredState = Math.random() < 0.5 ? "coffee" : "sofa";
            } else if (currentSatiety < 30) {
              preferredState = "fridge";
            } else if (currentHappiness < 30) {
              preferredState = Math.random() < 0.5 ? "pool" : "sofa";
            } else {
              preferredState = getPreferredStateForPersonality(agencyPersonality, isLoss);
            }

            const spot = getUnoccupiedSpot(preferredState, occupied, isLoss);
            occupied.add(spot.id);

            nextState = spot.state;
            nextTX = spot.x;
            nextTZ = spot.z;
            agentSitRotate = spot.sitRotate;
            nextSpotId = spot.id;

            // Timer duration matching the activity beautifully (1-to-2 minutes)
            nextTimer = getStateTimerForState(nextState);
          } else {
            // Keep current spot registered as occupied so nobody steals it during their timer
            if (nextSpotId) {
              occupied.add(nextSpotId);
            }
          }

          // Determine lifeStatus representation
          let currentLifeStatus = "Satisfeito ✨";
          if (isLoss) {
            currentLifeStatus = "Chateado 📉🥺";
          } else if (currentEnergy < 35) {
            currentLifeStatus = "Exausto 🔋";
          } else if (currentSatiety < 35) {
            currentLifeStatus = "Com Fome 🍎";
          } else if (currentHappiness < 35) {
            currentLifeStatus = "Entediado 🧠";
          } else if (nextState === "work") {
            currentLifeStatus = "Codando 💻";
          } else if (nextState === "pool") {
            currentLifeStatus = "Relaxando 🏊";
          } else if (nextState === "sofa") {
            currentLifeStatus = "Descansando 🛋️";
          } else if (nextState === "coffee") {
            currentLifeStatus = "Cafezinho ☕";
          } else if (nextState === "fridge") {
            currentLifeStatus = "Comendo 🍕";
          } else if (nextState === "water") {
            currentLifeStatus = "Hidratando 💧";
          }

          // Thoughts logic: periodically or upon entering a state
          let currentThought = agent.thought;
          const stateChanged = nextState !== agent.state;
          if (stateChanged || !currentThought || Math.random() < 0.15) {
            if (isLoss) {
              const activeSad = SAD_THOUGHTS;
              currentThought = activeSad[Math.floor(Math.random() * activeSad.length)];
            } else {
              const pool = THOUGHTS_BY_STATE[nextState] || THOUGHTS_BY_STATE["walk"];
              currentThought = pool[Math.floor(Math.random() * pool.length)];
            }
          }

          return {
            ...agent,
            state: nextState,
            stateTimer: nextTimer,
            targetX: nextTX,
            targetZ: nextTZ,
            sitRotate: agentSitRotate,
            currentSpotId: nextSpotId,
            energy: Math.round(currentEnergy),
            satiety: Math.round(currentSatiety),
            happiness: Math.round(currentHappiness),
            thought: currentThought,
            lifeStatus: currentLifeStatus,
            // Slide coordinates backup representation
            x: THREE.MathUtils.lerp(agent.x, nextTX, 0.045),
            z: THREE.MathUtils.lerp(agent.z, nextTZ, 0.045),
          };
        });
      });
    }, 1000); // 1-second ticks provide massive performance boost & eliminate high-frequency React virtual DOM lag

    return () => clearInterval(intervals);
  }, [destinations]);

  return (
    <>
      {/* 1. Isometric Global Balanced Lighting */}
      <ambientLight intensity={1.5} />
      
      {/* Beautiful shadows from isometric source angle */}
      <directionalLight
        castShadow
        position={[6, 11, 8]}
        intensity={2.1}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={32}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-bias={-0.0001}
      />

      {/* Modern ambient glowing spikes */}
      <pointLight position={[-3, 2.5, -2]} intensity={1.2} color="#8b5cf6" distance={9} /> {/* Purple stock aura */}
      <pointLight position={[3, 2, -2]} intensity={1.4} color="#10b981" distance={8} />  {/* Green garden aura */}
      <pointLight position={[0, 2.5, -3]} intensity={1.3} color="#06b6d4" distance={8} />  {/* Swimming pool aura */}

      {/* 2. Room Floor Diorama Plateau - Matches screenshot block design */}
      {/* Extremely bright, beautiful pinkish white-skin colored (cor de pele bem branco) soft plaster flooring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <planeGeometry args={[11, 11]} />
        <meshStandardMaterial color="#fff0e5" roughness={0.88} metalness={0.01} />
      </mesh>

      {/* Solid wooden dark diorama bottom base platform */}
      <mesh position={[0, -0.22, 0]} receiveShadow>
        <boxGeometry args={[11.08, 0.42, 11.08]} />
        <meshStandardMaterial color="#1a1917" roughness={0.9} />
      </mesh>

      {/* 3. Beautiful Diorama Walls (Back-Left and Back-Right boundaries) */}
      {/* Back-Left Wall */}
      <group>
        {/* Wall structure */}
        <mesh position={[-5.56, 1.4, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.12, 2.8, 11.0]} />
          <meshStandardMaterial color="#faf6ee" roughness={0.85} /> {/* Elegant bright warm off-white plaster */}
        </mesh>
        {/* Wood Baseboard (Skirting) */}
        <mesh position={[-5.48, 0.1, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.04, 0.2, 11.0]} />
          <meshStandardMaterial color="#854d0e" roughness={0.7} />
        </mesh>
        {/* Top Coping Trim Bar */}
        <mesh position={[-5.56, 2.83, 0]} castShadow>
          <boxGeometry args={[0.16, 0.06, 11.04]} />
          <meshStandardMaterial color="#1a1917" roughness={0.9} />
        </mesh>
        
        {/* Framed Business Growth Chart (Wall Decal Frame) */}
        <group position={[-5.48, 1.6, -2.5]} rotation={[0, Math.PI / 2, 0]}>
          <mesh castShadow>
            <boxGeometry args={[1.5, 0.9, 0.04]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          <mesh position={[0, 0, 0.025]}>
            <boxGeometry args={[1.4, 0.8, 0.01]} />
            <meshStandardMaterial color="#020617" emissive="#10b981" emissiveIntensity={0.25} />
          </mesh>
          {/* Chart Green Trend Line (Representing our investments going up!) */}
          <mesh position={[-0.4, -0.2, 0.03]} rotation={[0, 0, 0.5]}>
            <boxGeometry args={[0.6, 0.02, 0.01]} />
            <meshBasicMaterial color="#10b981" />
          </mesh>
          <mesh position={[0.1, 0.0, 0.03]} rotation={[0, 0, 0.8]}>
            <boxGeometry args={[0.6, 0.02, 0.01]} />
            <meshBasicMaterial color="#10b981" />
          </mesh>
          <mesh position={[0.5, 0.25, 0.03]} rotation={[0, 0, 0.2]}>
            <boxGeometry args={[0.4, 0.02, 0.01]} />
            <meshBasicMaterial color="#10b981" />
          </mesh>
        </group>
      </group>

      {/* Right Wall */}
      <group>
        {/* Wall structure */}
        <mesh position={[5.56, 1.4, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.12, 2.8, 11.0]} />
          <meshStandardMaterial color="#faf6ee" roughness={0.85} /> {/* Elegant bright warm off-white plaster */}
        </mesh>
        {/* Wood Baseboard (Skirting) */}
        <mesh position={[5.48, 0.1, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.04, 0.2, 11.0]} />
          <meshStandardMaterial color="#854d0e" roughness={0.7} />
        </mesh>
        {/* Top Coping Trim Bar */}
        <mesh position={[5.56, 2.83, 0]} castShadow>
          <boxGeometry args={[0.16, 0.06, 11.04]} />
          <meshStandardMaterial color="#1a1917" roughness={0.9} />
        </mesh>
        
        {/* Framed Certificate (Right Wall Decal Frame) */}
        <group position={[5.48, 1.6, -2.5]} rotation={[0, -Math.PI / 2, 0]}>
          <mesh castShadow>
            <boxGeometry args={[1.2, 0.8, 0.04]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          <mesh position={[0, 0, 0.025]}>
            <boxGeometry args={[1.1, 0.7, 0.01]} />
            <meshStandardMaterial color="#312e81" emissive="#3b82f6" emissiveIntensity={0.2} />
          </mesh>
          {/* Certificate golden badge */}
          <mesh position={[0, 0, 0.03]}>
            <boxGeometry args={[0.2, 0.2, 0.01]} />
            <meshBasicMaterial color="#eab308" />
          </mesh>
        </group>
      </group>

      {/* Back-Right Wall */}
      <group>
        {/* Wall structure */}
        <mesh position={[0, 1.4, -5.56]} castShadow receiveShadow>
          <boxGeometry args={[11.0, 2.8, 0.12]} />
          <meshStandardMaterial color="#faf6ee" roughness={0.85} /> {/* Elegant plaster */}
        </mesh>
        {/* Wood Baseboard (Skirting) */}
        <mesh position={[0, 0.1, -5.48]} castShadow receiveShadow>
          <boxGeometry args={[11.0, 0.2, 0.04]} />
          <meshStandardMaterial color="#854d0e" roughness={0.7} />
        </mesh>
        {/* Top Coping Trim Bar */}
        <mesh position={[0, 2.83, -5.56]} castShadow>
          <boxGeometry args={[11.04, 0.06, 0.16]} />
          <meshStandardMaterial color="#1a1917" roughness={0.9} />
        </mesh>

        {/* Corporate Slogan Plaque: "INVESTIMENTOS INTELIGENTES" - Left completely clean */}
        <group position={[2.0, 1.8, -5.48]}>
          <mesh castShadow>
            <boxGeometry args={[2.5, 0.4, 0.04]} />
            <meshStandardMaterial color="#2d1500" roughness={0.5} /> {/* Dark walnut frame */}
          </mesh>
          <mesh position={[0, 0, 0.025]}>
            <boxGeometry args={[2.4, 0.3, 0.01]} />
            <meshStandardMaterial color="#ecd0b9" roughness={0.8} /> {/* Skin matching bronze label background */}
          </mesh>
        </group>
      </group>

      {/* 4. ASSETS: CDB Swimming Pool (Back Center) */}
      <CdbPool
        position={[0, 0, -3.2]}
        onSelect={() => onSelectEntity({ type: "asset", id: "cdb_pool" })}
        isSelected={selectedEntity?.type === "asset" && selectedEntity.id === "cdb_pool"}
      />

      {/* 5. MINI PISCINA: Back-Right corner relaxation pool */}
      <MiniPiscina />

      {/* 7. ASSETS: Stocks zone platforms (Back Left) - Decorative Carpet Rug expanded for our new couch square! */}
      <StocksPlatform position={[-3.0, 0, -1.0]} />

      {/* Three ultra-luxury voxel sofas forming a cozy square couch cluster facing each other around the TV */}
      <VoxelSofa position={[-3.8, 0, -1.0]} rotation={0} color="#0f766e" /> {/* West sofa (Cozy teal) */}
      <VoxelSofa position={[-2.4, 0, -2.4]} rotation={-Math.PI / 2} color="#ea580c" /> {/* North sofa (Terracotta, facing South) */}
      <VoxelSofa position={[-2.4, 0, 0.4]} rotation={Math.PI / 2} color="#6366f1" /> {/* South sofa (Indigo, facing North) */}

      {/* Cyberpunk TV and Retro Console gaming station that closes off the U-shaped couch square from the East */}
      <VoxelGamingStation position={[-1.1, 0.02, -1.0]} />

      {/* 9. WORKSPACES: 4 Desks forming a Quad island/square cluster at the bottom-left corner */}
      {/* South-West PC Desk (Facing North) */}
      <OfficeDesk position={[-3.95, 0, 3.55]} rotation={0} chairColor="#8b5cf6" />
      
      {/* South-East PC Desk (Facing North) */}
      <OfficeDesk position={[-2.75, 0, 3.55]} rotation={0} chairColor="#0d9488" />

      {/* North-West PC Desk (Facing South) */}
      <OfficeDesk position={[-3.95, 0, 2.95]} rotation={Math.PI} chairColor="#ea580c" />

      {/* North-East PC Desk (Facing South) */}
      <OfficeDesk position={[-2.75, 0, 2.95]} rotation={Math.PI} chairColor="#0284c7" />

      {/* 9A. RECREATIONAL: INTEGRATED OFFICE KITCHENETTE (COPA) AGAINST BACK WALL */}
      {/* Kitchen Floor Tiles */}
      <mesh position={[-3.3, 0.015, -4.4]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[3.8, 1.4]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} /> {/* Elegant dark slate tiles area */}
      </mesh>

      {/* Modern Tall Refrigerator (Geladeira) with dynamic door opening & interactive food items inside */}
      <VoxelRefrigerator isOpen={agentsNearFridge.size > 0} />

      {/* Main Kitchen Counter & Sinks */}
      <group position={[-3.1, 0, -4.6]}>
        {/* Cabinet base */}
        <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.0, 0.8, 0.62]} />
          <meshStandardMaterial color="#3f1e04" roughness={0.7} /> {/* Warm rich cherry wood */}
        </mesh>
        {/* Cabinet doors dividing lines (very subtle grey stripes) */}
        <mesh position={[-0.5, 0.4, 0.314]}>
          <boxGeometry args={[0.01, 0.74, 0.01]} />
          <meshBasicMaterial color="#1a0a01" />
        </mesh>
        <mesh position={[0.5, 0.4, 0.314]}>
          <boxGeometry args={[0.01, 0.74, 0.01]} />
          <meshBasicMaterial color="#1a0a01" />
        </mesh>
        {/* Minimalist metallic door handles */}
        <mesh position={[-0.52, 0.65, 0.325]}>
          <boxGeometry args={[0.02, 0.08, 0.02]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.8} />
        </mesh>
        <mesh position={[0.48, 0.65, 0.325]}>
          <boxGeometry args={[0.02, 0.08, 0.02]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.8} />
        </mesh>
        
        {/* Dark Slate Countertop */}
        <mesh position={[0, 0.81, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.04, 0.02, 0.66]} />
          <meshStandardMaterial color="#111827" roughness={0.15} />
        </mesh>

        {/* Integrated sink bowl + Faucet */}
        <group position={[-0.7, 0.825, 0.05]}>
          <mesh castShadow>
            <boxGeometry args={[0.4, 0.01, 0.3]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
          </mesh>
          <mesh position={[0, 0.005, 0]}>
            <boxGeometry args={[0.34, 0.01, 0.24]} />
            <meshStandardMaterial color="#020617" roughness={0.4} /> {/* Drain basin hole */}
          </mesh>
          {/* Faucet stem */}
          <mesh position={[-0.15, 0.15, -0.05]} castShadow>
            <boxGeometry args={[0.04, 0.3, 0.04]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
          </mesh>
          <mesh position={[-0.07, 0.3, -0.05]} castShadow>
            <boxGeometry args={[0.18, 0.04, 0.04]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
          </mesh>
        </group>

        {/* 9B. Coffee Maker (seated on right side of counter) */}
        <group position={[0.4, 0.82, -0.05]}>
          {/* Coffee Maker Box */}
          <mesh position={[0, 0.16, 0]} castShadow>
            <boxGeometry args={[0.3, 0.32, 0.3]} />
            <meshStandardMaterial color="#475569" metalness={0.5} roughness={0.3} />
          </mesh>
          {/* Coffee Glass Jug */}
          <mesh position={[0.07, 0.1, 0.0]} castShadow>
            <boxGeometry args={[0.18, 0.18, 0.18]} />
            <meshStandardMaterial color="#38bdf8" transparent opacity={0.65} roughness={0.15} />
          </mesh>
          {/* White cups stack block */}
          <mesh position={[-0.07, 0.09, 0.05]} castShadow>
            <boxGeometry args={[0.14, 0.18, 0.14]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.6} />
          </mesh>
        </group>
      </group>

      {/* Floating Overhead Shelves loaded with little colorful office mugs & succulent */}
      <group position={[-3.1, 1.6, -4.85]}>
        {/* Floating Shelf board */}
        <mesh castShadow>
          <boxGeometry args={[1.8, 0.04, 0.24]} />
          <meshStandardMaterial color="#5c2e0b" roughness={0.7} />
        </mesh>
        {/* Colorful cups series */}
        <mesh position={[-0.6, 0.08, 0]} castShadow>
          <boxGeometry args={[0.09, 0.11, 0.09]} />
          <meshStandardMaterial color="#14b8a6" roughness={0.5} /> {/* Teal mug */}
        </mesh>
        <mesh position={[-0.3, 0.08, 0]} castShadow>
          <boxGeometry args={[0.09, 0.11, 0.09]} />
          <meshStandardMaterial color="#f43f5e" roughness={0.5} /> {/* Coral pink mug */}
        </mesh>
        <mesh position={[0.1, 0.08, 0]} castShadow>
          <boxGeometry args={[0.09, 0.11, 0.09]} />
          <meshStandardMaterial color="#eab308" roughness={0.5} /> {/* Yellow mug */}
        </mesh>
        {/* Mini potted plant */}
        <group position={[0.55, 0, 0]}>
          <mesh position={[0, 0.06, 0]} castShadow>
            <boxGeometry args={[0.12, 0.12, 0.12]} />
            <meshStandardMaterial color="#a16207" roughness={0.8} /> {/* Brown pot */}
          </mesh>
          <mesh position={[0, 0.16, 0]} castShadow>
            <boxGeometry args={[0.16, 0.1, 0.16]} />
            <meshStandardMaterial color="#22c55e" roughness={0.9} /> {/* Green succulent leaves */}
          </mesh>
        </group>
      </group>

      {/* Modern Voxel Water Cooler neatly organized next to the kitchen counter */}
      <group position={[-1.7, 0, -4.6]}>
        {/* Cooler dispenser base stand */}
        <mesh position={[0, 0.48, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.34, 0.96, 0.34]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.4} />
        </mesh>
        {/* Dispenser levers (hot/cold - red/blue strips) */}
        <mesh position={[0, 0.78, 0.18]} castShadow>
          <boxGeometry args={[0.14, 0.05, 0.03]} />
          <meshStandardMaterial color="#ef4444" /> {/* Hot lever */}
        </mesh>
        <mesh position={[0, 0.78, 0.15]} castShadow>
          <boxGeometry args={[0.02, 0.02, 0.02]} />
          <meshStandardMaterial color="#3b82f6" /> {/* Cold marker */}
        </mesh>
        {/* Clear/Blue water container dome */}
        <mesh position={[0, 1.25, 0]} castShadow>
          <cylinderGeometry args={[0.14, 0.14, 0.5, 8]} />
          <meshStandardMaterial color="#38bdf8" transparent opacity={0.75} roughness={0.1} />
        </mesh>
      </group>

      {/* 10. Environmental lighting sparkling floating particles */}
      <Particles />

      {/* 11. Render the Voxel AI Employees with their dynamic tag labels */}
      {agents.map((agent) => (
        <VoxelAgent
          key={agent.id}
          agent={agent}
          isSelected={selectedEntity?.type === "agent" && selectedEntity.id === agent.id}
          onSelect={() => onSelectEntity({ type: "agent", id: agent.id })}
          onFridgeProximityChange={handleFridgeProximity}
          isMarketOpen={isMarketOpen}
        />
      ))}

      {/* 12. Locked stable camera Controls to prevent camera shift, rotation, or drifting */}
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        enableRotate={false}
        target={[0, targetY, 0]}
      />
    </>
  );
}

// Camera Controller to dynamically adjust the field of view (zoom level) based on the viewport aspect ratio.
// This prevents the 3D scene from being cut off or appearing extremely zoomed in on vertical/mobile aspect ratios.
function CameraController() {
  const { camera, size } = useThree();

  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      const rawAspect = size.height > 0 ? size.width / size.height : 1;
      // Handle initial canvas default size (300x150) before ResizeObserver updates to avoid giant zoom-in flash on first paint
      const isInitialPlaceholder = (size.width === 300 && size.height === 150) || size.height <= 0;
      const aspect = isInitialPlaceholder
        ? (window.innerHeight > 0 ? window.innerWidth / window.innerHeight : 1)
        : rawAspect;

      if (aspect < 1.1) {
        // Calculate dynamic FOV based on narrow aspect ratio (vertical zoom level compensation)
        const baseFov = 34.5;
        const aspectCorrection = (1.1 - aspect) * 26;
        camera.fov = Math.min(55, Math.max(34.5, baseFov + aspectCorrection));
      } else {
        camera.fov = 34.5;
      }
      camera.updateProjectionMatrix();
    }
  }, [size.width, size.height, camera]);

  return null;
}

// Global Canvas viewport context wrapper
export default function ThreeOfficeScene({ agents, portfolioStats, onSelectEntity, selectedEntity, onAgentsUpdate, isMarketOpen = true, isActive = true }: ThreeOfficeSceneProps) {
  return (
    <div className="w-full h-full relative bg-[#090514] select-none touch-none">
      <Canvas
        shadows
        frameloop={isActive ? "always" : "never"}
        camera={{
          fov: 34.5,
          position: [0, 11.5, 20.3], // centered front-facing view slightly further back
        }}
        gl={{ antialias: true, alpha: false }}
        onPointerDown={(e) => {
          // Deselect when clicking blank canvas background
          if (e.target === e.currentTarget) {
            onSelectEntity(null);
          }
        }}
      >
        <CameraController />
        <OfficeSceneContent
          agents={agents}
          portfolioStats={portfolioStats}
          onSelectEntity={onSelectEntity}
          selectedEntity={selectedEntity}
          onAgentsUpdate={onAgentsUpdate}
          isMarketOpen={isMarketOpen}
        />
      </Canvas>
    </div>
  );
}
