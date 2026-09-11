const canvas = document.querySelector("#ambient-field");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Light adaptation of the flow field used on cgilabsub.github.io:
// same motion, but painted as dark pastel strokes on a white wash.
const FLOW_PALETTE = [
  [93, 146, 134], // green
  [95, 143, 183], // blue
  [140, 122, 184], // violet
  [201, 135, 114], // coral
];

let ctx;
let width = 0;
let height = 0;
let pixelRatio = 1;
let flowPoints = [];
let flowAnimationId = null;

if (canvas) {
  ctx = canvas.getContext("2d", { alpha: true });
  startFlowBackground();
}

// Reduced-motion users still get the flow, just calmed right down.
const FLOW_TEMPO = reduceMotion ? 0.28 : 1;

function startFlowBackground() {
  resizeFlowCanvas();
  window.addEventListener("resize", resizeFlowCanvas);

  if (!flowAnimationId) {
    flowAnimationId = requestAnimationFrame(drawFlowBackground);
  }
}

function resizeFlowCanvas() {
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const newWidth = window.innerWidth;
  const newHeight = window.innerHeight;

  // On mobile, avoid jerky rebuild when URL bar expands/collapses slightly
  if (width === newWidth && Math.abs(height - newHeight) < 90 && flowPoints.length > 0) {
    return;
  }

  width = newWidth;
  height = newHeight;

  canvas.width = Math.floor(width * pixelRatio);
  canvas.height = Math.floor(height * pixelRatio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  const mobile = width < 768;
  // Dynamic column and row spacing to ensure natural particle density across all screen sizes
  const columns = mobile ? Math.max(28, Math.round(width / 13)) : Math.max(90, Math.round(width / 8));
  const rows = mobile ? Math.max(20, Math.round(height / 32)) : Math.max(28, Math.round(height / 24));
  flowPoints = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      flowPoints.push({
        xRatio: column / Math.max(columns - 1, 1),
        yRatio: row / Math.max(rows - 1, 1),
        drift: Math.random() * Math.PI * 2,
        speed: 0.055 + Math.random() * 0.085,
        size: mobile ? 0.5 + Math.random() * 1.3 : 0.6 + Math.random() * 1.7,
        opacity: 0.32 + Math.random() * 0.58,
      });
    }
  }
}

function drawFlowBackground(time) {
  const seconds = time * 0.001 * FLOW_TEMPO;
  const mobile = width < 768;

  // Consistent, elegant horizontal band placement
  const bandTop = mobile ? 0.28 : 0.34;
  const bandSpread = mobile ? 0.42 : 0.48;

  // Screen-proportional wave parameters so mobile waves are gentle and not squished
  const waveAFreq = mobile ? 3.4 : 9.4;
  const waveBFreq = mobile ? 1.8 : 3.6;
  const waveAAmp = mobile ? Math.min(height * 0.045, 26) : height * 0.1;
  const waveBAmp = mobile ? Math.min(height * 0.02, 10) : height * 0.035;

  ctx.clearRect(0, 0, width, height);

  const wash = ctx.createLinearGradient(0, 0, 0, height);
  wash.addColorStop(0, "#ffffff");
  wash.addColorStop(0.58, "#fdfefe");
  wash.addColorStop(1, "#f5faf9");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, height);

  flowPoints.forEach((point, index) => {
    const layer = index % FLOW_PALETTE.length;
    const [r, g, b] = FLOW_PALETTE[layer];
    const stream = (point.xRatio + seconds * point.speed + layer * 0.035) % 1;
    const drift = Math.sin(seconds * 1.05 + point.drift) * (mobile ? 6 : 18);
    const x = stream * width + drift;
    const baseY = height * (bandTop + point.yRatio * bandSpread);
    const waveA = Math.sin(stream * waveAFreq - seconds * 1.9 + point.yRatio * (mobile ? 2.0 : 3.4));
    const waveB = Math.cos(stream * waveBFreq + seconds * 1.15 + layer);
    const y = baseY + waveA * waveAAmp + waveB * waveBAmp;
    const center = 0.45;
    const fade = Math.max(0, 1 - Math.abs(point.yRatio - center) * (mobile ? 1.4 : 1.55));
    const shimmer = 0.7 + Math.sin(seconds * 2.1 + point.drift) * 0.3;
    // Fade in from the left edge and out at the right so streams enter and leave cleanly.
    const edge = Math.min(1, stream * 7) * Math.min(1, (1 - stream) * 7);
    const alpha = Math.min(0.92, point.opacity * fade * shimmer * edge * 1.35);

    if (alpha <= 0.02) return;

    ctx.beginPath();
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    ctx.arc(x, y, point.size, 0, Math.PI * 2);
    ctx.fill();
  });

  const lineFreq = mobile ? 3.2 : 8;
  const lineAmp = mobile ? Math.min(height * 0.04, 24) : height * 0.085;

  for (let layer = 0; layer < 3; layer += 1) {
    const [r, g, b] = FLOW_PALETTE[layer + 1];
    ctx.beginPath();

    for (let step = 0; step <= 160; step += 1) {
      const progress = step / 160;
      const x = progress * width;
      const y =
        height * ((mobile ? 0.40 : 0.48) + layer * (mobile ? 0.055 : 0.07)) +
        Math.sin(progress * lineFreq - seconds * (1.45 + layer * 0.24) + layer) * lineAmp;

      if (step === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.34 - layer * 0.07})`;
    ctx.lineWidth = mobile ? 1.3 : 1.6;
    ctx.stroke();
  }

  // Let the band settle toward the footer so body copy stays readable.
  const settle = ctx.createLinearGradient(0, 0, 0, height);
  settle.addColorStop(0, "rgba(255, 255, 255, 0)");
  settle.addColorStop(0.72, "rgba(253, 254, 254, 0.12)");
  settle.addColorStop(1, "rgba(245, 250, 249, 0.55)");
  ctx.fillStyle = settle;
  ctx.fillRect(0, 0, width, height);

  flowAnimationId = requestAnimationFrame(drawFlowBackground);
}

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
      }
    });
  },
  { threshold: 0.16 }
);

document
  .querySelectorAll(
    ".reveal, .reveal-from-right, .project-card, .craft-card, .about-section, .contact-section, .case-study, .process-step"
  )
  .forEach((item) => {
    if (!item.classList.contains("reveal-from-right")) {
      item.classList.add("reveal");
    }
    revealObserver.observe(item);
  });
