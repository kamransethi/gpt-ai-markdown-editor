/**
 * Knowledge Graph Webview — canvas-based force-directed graph.
 *
 * No external dependencies. Uses a simple force simulation:
 *   - Repulsion between all node pairs (O(n²), fine for <1000 nodes)
 *   - Spring attraction on edges
 *   - Center gravity to keep the graph from drifting
 *   - Damping for stable convergence
 *
 * Interaction: scroll to zoom, drag to pan, drag nodes, click to open.
 */

// ── VS Code API ────────────────────────────────────────────────────────────

declare function acquireVsCodeApi(): { postMessage(msg: unknown): void };
const vscode = acquireVsCodeApi();

// ── Types ──────────────────────────────────────────────────────────────────

interface GraphNode {
  id: string;
  label: string;
  tags: string[];
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface GraphEdge {
  source: string;
  target: string;
}

// ── State ──────────────────────────────────────────────────────────────────

let nodes: GraphNode[] = [];
let edges: GraphEdge[] = [];
let nodeMap = new Map<string, GraphNode>();

const canvas = document.getElementById('graph') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

let camX = 0;
let camY = 0;
let zoom = 1;
let animHandle = 0;

// Interaction state
let draggingNode: GraphNode | null = null;
let panning = false;
let panStart = { x: 0, y: 0, camX: 0, camY: 0 };

// ── Resize ─────────────────────────────────────────────────────────────────

function resize() {
  canvas.width = window.innerWidth * devicePixelRatio;
  canvas.height = window.innerHeight * devicePixelRatio;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.scale(devicePixelRatio, devicePixelRatio);
}
window.addEventListener('resize', resize);
resize();

// ── Color palette (deterministic by tag) ──────────────────────────────────

const PALETTE = [
  '#4ea8de',
  '#56cfe1',
  '#72efdd',
  '#80ffdb',
  '#c77dff',
  '#e77d7d',
  '#f4a261',
  '#e9c46a',
];

function colorForNode(node: GraphNode): string {
  if (node.tags.length === 0) return '#6e6e80';
  const h = node.tags[0].split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return PALETTE[h % PALETTE.length];
}

// ── Layout helpers ─────────────────────────────────────────────────────────

function toScreen(wx: number, wy: number): [number, number] {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  return [(wx + camX) * zoom + cx, (wy + camY) * zoom + cy];
}

function toWorld(sx: number, sy: number): [number, number] {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  return [(sx - cx) / zoom - camX, (sy - cy) / zoom - camY];
}

function nodeAt(sx: number, sy: number): GraphNode | null {
  for (const n of nodes) {
    const [nx, ny] = toScreen(n.x, n.y);
    const d = Math.hypot(sx - nx, sy - ny);
    if (d <= n.radius * zoom + 4) return n;
  }
  return null;
}

// ── Force simulation ───────────────────────────────────────────────────────

const REPULSION = 3000;
const SPRING_LEN = 120;
const SPRING_K = 0.04;
const GRAVITY = 0.02;
const DAMPING = 0.85;

function tick() {
  // Repulsion
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i],
        b = nodes[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist2 = dx * dx + dy * dy + 1;
      const dist = Math.sqrt(dist2);
      const force = REPULSION / dist2;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx -= fx;
      a.vy -= fy;
      b.vx += fx;
      b.vy += fy;
    }
  }

  // Spring attraction on edges
  for (const edge of edges) {
    const src = nodeMap.get(edge.source);
    const tgt = nodeMap.get(edge.target);
    if (!src || !tgt) continue;
    const dx = tgt.x - src.x;
    const dy = tgt.y - src.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const stretch = dist - SPRING_LEN;
    const force = SPRING_K * stretch;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    src.vx += fx;
    src.vy += fy;
    tgt.vx -= fx;
    tgt.vy -= fy;
  }

  // Center gravity + integrate
  for (const n of nodes) {
    if (n === draggingNode) continue;
    n.vx += -n.x * GRAVITY;
    n.vy += -n.y * GRAVITY;
    n.vx *= DAMPING;
    n.vy *= DAMPING;
    n.x += n.vx;
    n.y += n.vy;
  }
}

// ── Render ─────────────────────────────────────────────────────────────────

const W_EDGE = 'rgba(255,255,255,0.12)';
const _W_EDGE_HL = 'rgba(255,255,255,0.35)'; // reserved for hover highlight

function draw() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  ctx.clearRect(0, 0, W, H);

  // Edges
  ctx.lineWidth = 1;
  for (const edge of edges) {
    const src = nodeMap.get(edge.source);
    const tgt = nodeMap.get(edge.target);
    if (!src || !tgt) continue;
    const [sx, sy] = toScreen(src.x, src.y);
    const [tx, ty] = toScreen(tgt.x, tgt.y);
    ctx.beginPath();
    ctx.strokeStyle = W_EDGE;
    ctx.moveTo(sx, sy);
    ctx.lineTo(tx, ty);
    ctx.stroke();
  }

  // Nodes
  for (const n of nodes) {
    const [x, y] = toScreen(n.x, n.y);
    const r = n.radius * zoom;
    const color = colorForNode(n);

    // Glow
    ctx.beginPath();
    ctx.arc(x, y, r + 3, 0, Math.PI * 2);
    ctx.fillStyle = color + '33';
    ctx.fill();

    // Circle
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Label (only when zoom is large enough)
    if (zoom > 0.5) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `${Math.max(9, 11 * zoom)}px var(--vscode-font-family, sans-serif)`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(n.label, x, y + r + 10 * zoom);
    }
  }
}

// ── Animation loop ─────────────────────────────────────────────────────────

function loop() {
  if (nodes.length === 0) {
    drawEmptyState();
    animHandle = requestAnimationFrame(loop);
    return;
  }
  tick();
  draw();
  animHandle = requestAnimationFrame(loop);
}

// ── Interaction ────────────────────────────────────────────────────────────

canvas.addEventListener(
  'wheel',
  e => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    zoom = Math.max(0.1, Math.min(5, zoom * factor));
  },
  { passive: false }
);

canvas.addEventListener('mousedown', e => {
  const hit = nodeAt(e.clientX, e.clientY);
  if (hit) {
    draggingNode = hit;
  } else {
    panning = true;
    panStart = { x: e.clientX, y: e.clientY, camX, camY };
  }
});

canvas.addEventListener('mousemove', e => {
  if (draggingNode) {
    const [wx, wy] = toWorld(e.clientX, e.clientY);
    draggingNode.x = wx;
    draggingNode.y = wy;
    draggingNode.vx = 0;
    draggingNode.vy = 0;
  } else if (panning) {
    camX = panStart.camX + (e.clientX - panStart.x) / zoom;
    camY = panStart.camY + (e.clientY - panStart.y) / zoom;
  }
});

canvas.addEventListener('mouseup', e => {
  if (draggingNode) {
    const dist = Math.hypot(e.clientX - panStart.x, e.clientY - panStart.y);
    if (dist < 4) {
      // Treat as click — open file
      vscode.postMessage({ type: 'openFile', path: draggingNode.id });
    }
    draggingNode = null;
  }
  panning = false;
});

canvas.addEventListener('mouseleave', () => {
  draggingNode = null;
  panning = false;
});

// Track mousedown position for click detection
canvas.addEventListener(
  'mousedown',
  e => {
    panStart.x = e.clientX;
    panStart.y = e.clientY;
  },
  { capture: true }
);

// ── Message handling ───────────────────────────────────────────────────────

interface NodeData {
  id: string;
  label: string;
  tags: string[];
}
interface EdgeData {
  source: string;
  target: string;
}

window.addEventListener('message', (event: MessageEvent) => {
  const msg = event.data as {
    type: string;
    nodes?: NodeData[];
    edges?: EdgeData[];
    loading?: boolean;
  };
  if (msg.type === 'graphData' && msg.nodes && msg.edges) {
    loadGraph(msg.nodes, msg.edges, msg.loading ?? false);
  }
});

function loadGraph(rawNodes: NodeData[], rawEdges: EdgeData[], loading = false) {
  cancelAnimationFrame(animHandle);
  _loadingFlag = loading;

  // Degree map for sizing nodes
  const degree = new Map<string, number>();
  for (const e of rawEdges) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  }

  nodes = rawNodes.map(n => {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * 300;
    return {
      id: n.id,
      label: n.label,
      tags: n.tags,
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      vx: 0,
      vy: 0,
      radius: 6 + Math.min(degree.get(n.id) ?? 0, 10),
    };
  });

  nodeMap = new Map(nodes.map(n => [n.id, n]));
  edges = rawEdges.filter(e => nodeMap.has(e.source) && nodeMap.has(e.target));

  loop();
}

// ── Empty / loading state overlay ─────────────────────────────────────────

let _loadingFlag = false;

function drawEmptyState() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '14px var(--vscode-font-family, sans-serif)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    _loadingFlag ? 'Indexing workspace…' : 'No notes found. Open a workspace with .md files.',
    W / 2,
    H / 2
  );
}

// ── Boot ───────────────────────────────────────────────────────────────────

// Start rendering an empty state immediately so the canvas isn't black
loadGraph([], [], true);

vscode.postMessage({ type: 'ready' });
