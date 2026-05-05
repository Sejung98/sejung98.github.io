const canvas = document.querySelector("#ambient-field");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const animateTilePulse = true;

let ctx;
let width = 0;
let height = 0;
let pixelRatio = 1;
let wheelRadius = 0;
let wheelCenterX = 0;
let wheelCenterY = 0;
let tiles = [];
let guideLines = [];
let activeWheelCenterX = 0;
let activeWheelCenterY = 0;
let svImage;
let svImageReady = false;
let svAnchorElement;
let svX = 0;
let svY = 0;
let svOpacity = 0;
let targetScrollTop = 0;
let smoothScrollTop = 0;
let scrollMax = 1;
let lastFrame = 0;

if (canvas) {
  ctx = canvas.getContext("2d", { alpha: true });
  setupTileBackground();
}

function setupTileBackground() {
  setupSvImage();
  svAnchorElement = document.querySelector(".project-rail .project-card:nth-child(3) .project-meta");
  resizeCanvas();
  updateScrollTarget();
  smoothScrollTop = targetScrollTop;
  window.addEventListener("resize", () => {
    resizeCanvas();
    updateScrollTarget();
  });
  window.addEventListener("scroll", updateScrollTarget, { passive: true });
  requestAnimationFrame(drawBackground);
}

function resizeCanvas() {
  pixelRatio = Math.min(window.devicePixelRatio || 1, 1.1);
  width = window.innerWidth;
  height = window.innerHeight;

  canvas.width = Math.floor(width * pixelRatio);
  canvas.height = Math.floor(height * pixelRatio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  wheelCenterX = width < 720 ? width * 0.06 : width * 0.14;
  wheelCenterY = width < 720 ? height * 0.3 : height * 0.36;
  wheelRadius = width < 720 ? Math.min(width * 0.72, 340) : Math.min(Math.max(width, height) * 0.35, 470);

  buildTiles();
  buildGuideLines();
  scrollMax = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
}

function buildTiles() {
  const colors = ["43, 98, 255", "22, 163, 107", "251, 188, 4", "234, 67, 53", "32, 36, 42", "0, 163, 199"];
  const random = seededRandom(77);
  const nextTiles = [];
  const innerRadius = getWheelInnerRadius();
  const ringGap = width < 720 ? 42 : 48;
  let ringIndex = 0;

  for (let radius = innerRadius + ringGap * 0.56; radius < wheelRadius; radius += ringGap) {
    const slotSize = width < 720 ? 78 : 94;
    const density = Math.max(12, Math.floor((Math.PI * 2 * radius) / slotSize));
    const slotSpan = (Math.PI * 2) / density;
    const ringOffset = (ringIndex % 2) * slotSpan * 0.5 + (random() - 0.5) * 0.018;

    for (let index = 0; index < density; index += 1) {
      const angle = (index / density) * Math.PI * 2 + ringOffset;
      const outer = radius / wheelRadius;
      const rightSide = Math.cos(angle) > 0.03;
      const skipChance = rightSide ? 0.46 + outer * 0.22 : 0.16 + outer * 0.12;

      if (random() < skipChance) {
        continue;
      }

      const tileRadius = radius + (random() - 0.5) * 2;
      const tangentX = -Math.sin(angle);
      const tangentY = Math.cos(angle);
      const maxLength = radius * slotSpan * 0.62;
      const length = Math.min(18 + random() * (rightSide ? 24 : 30), maxLength);
      const thickness = Math.min(ringGap * 0.46, 8.5 + random() * 7.5);
      const baseAlpha = Math.max(0.24, 0.82 - outer * 0.16 - (rightSide ? 0.04 : 0));
      const colorIndex = (ringIndex + Math.floor(random() * colors.length)) % colors.length;
      const pulsePeriod = 11000 + random() * 18000;

      nextTiles.push({
        relX: Math.cos(angle) * tileRadius,
        relY: Math.sin(angle) * tileRadius,
        tangentX,
        tangentY,
        length,
        thickness,
        color: colors[colorIndex],
        baseAlpha,
        phase: random() * Math.PI * 2,
        pulseOffset: random() * pulsePeriod,
        pulsePeriod,
      });
    }

    ringIndex += 1;
  }

  tiles = nextTiles;
}

function buildGuideLines() {
  guideLines = [];
  const innerRadius = getWheelInnerRadius();

  for (let radius = innerRadius + 18; radius < wheelRadius; radius += width < 720 ? 78 : 96) {
    guideLines.push({ type: "circle", radius });
  }

  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 24) {
    guideLines.push({ type: "ray", angle });
  }
}

function drawBackground(time) {
  const delta = Math.min((time - lastFrame) / 16.67 || 1, 2.2);
  lastFrame = time;
  updateSmoothScroll(delta);

  const scroll = getScrollState();
  activeWheelCenterX = wheelCenterX;
  activeWheelCenterY =
    wheelCenterY + height * 0.18 - scroll.progress * (height + (width < 720 ? 260 : 520));

  ctx.clearRect(0, 0, width, height);
  drawPaper();
  ctx.save();
  ctx.globalAlpha = getWheelVisibility(scroll.progress);
  drawGuides();
  drawTiles(time);
  drawCenterCutout();
  ctx.restore();
  drawFade();
  drawSvImage(time, delta);

  requestAnimationFrame(drawBackground);
}

function drawPaper() {
  ctx.save();
  ctx.fillStyle = "#fdfdfb";
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = 0.12;
  ctx.fillStyle = "#2b62ff";
  for (let i = 0; i < 52; i += 1) {
    ctx.fillRect((i * 101) % width, (i * 61) % height, 1, 1);
  }

  ctx.restore();
}

function getWheelVisibility(progress) {
  return Math.max(0.12, 1 - smoothstep(0.72, 1, progress) * 0.62);
}

function drawGuides() {
  ctx.save();
  ctx.strokeStyle = "rgba(43, 98, 255, 0.045)";
  ctx.lineWidth = 0.8;
  const innerRadius = getWheelInnerRadius();

  guideLines.forEach((guide) => {
    ctx.beginPath();

    if (guide.type === "circle") {
      ctx.arc(activeWheelCenterX, activeWheelCenterY, guide.radius, 0, Math.PI * 2);
    } else {
      ctx.moveTo(
        activeWheelCenterX + Math.cos(guide.angle) * innerRadius,
        activeWheelCenterY + Math.sin(guide.angle) * innerRadius
      );
      ctx.lineTo(
        activeWheelCenterX + Math.cos(guide.angle) * wheelRadius,
        activeWheelCenterY + Math.sin(guide.angle) * wheelRadius
      );
    }

    ctx.stroke();
  });

  ctx.restore();
}

function drawTiles(time) {
  ctx.save();
  ctx.lineCap = "round";

  tiles.forEach((tile) => {
    const cycle = animateTilePulse ? ((time + tile.pulseOffset) % tile.pulsePeriod) / tile.pulsePeriod : 0.5;
    const pulse = animateTilePulse ? Math.exp(-Math.pow((cycle - 0.5) / 0.095, 2)) : 0;
    const idleWave = reduceMotion ? 0.58 : 0.42 + Math.sin(time * 0.00018 + tile.phase) * 0.06;
    const alpha = Math.max(0.14, Math.min(1, tile.baseAlpha * idleWave + pulse * 0.9));
    const x = activeWheelCenterX + tile.relX;
    const y = activeWheelCenterY + tile.relY;
    const half = (tile.length * (0.92 + pulse * 0.42)) / 2;

    ctx.beginPath();
    ctx.strokeStyle = `rgba(${tile.color}, ${alpha})`;
    ctx.lineWidth = tile.thickness * (0.82 + pulse * 0.58);
    ctx.moveTo(x - tile.tangentX * half, y - tile.tangentY * half);
    ctx.lineTo(x + tile.tangentX * half, y + tile.tangentY * half);
    ctx.stroke();

    if (pulse > 0.42) {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(255, 255, 255, ${(pulse - 0.42) * 0.16})`;
      ctx.lineWidth = tile.thickness * 0.22;
      ctx.moveTo(x - tile.tangentX * half, y - tile.tangentY * half);
      ctx.lineTo(x + tile.tangentX * half, y + tile.tangentY * half);
      ctx.stroke();
    }
  });

  ctx.restore();
}

function drawCenterCutout() {
  ctx.save();
  ctx.fillStyle = "#fdfdfb";
  ctx.beginPath();
  ctx.arc(activeWheelCenterX, activeWheelCenterY, getWheelInnerRadius() - 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function getWheelInnerRadius() {
  return width < 720 ? 76 : 94;
}

function drawFade() {
  const rightFade = ctx.createLinearGradient(0, 0, width, 0);
  rightFade.addColorStop(0, "rgba(253, 253, 251, 0)");
  rightFade.addColorStop(0.38, "rgba(253, 253, 251, 0)");
  rightFade.addColorStop(0.76, "rgba(253, 253, 251, 0.72)");
  rightFade.addColorStop(1, "rgba(253, 253, 251, 0.96)");

  ctx.fillStyle = rightFade;
  ctx.fillRect(0, 0, width, height);

  const verticalFade = ctx.createLinearGradient(0, 0, 0, height);
  verticalFade.addColorStop(0, "rgba(253, 253, 251, 0)");
  verticalFade.addColorStop(0.72, "rgba(253, 253, 251, 0)");
  verticalFade.addColorStop(1, "rgba(253, 253, 251, 0.9)");

  ctx.fillStyle = verticalFade;
  ctx.fillRect(0, 0, width, height);
}

function seededRandom(seed) {
  let value = seed;

  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

function setupSvImage() {
  svImage = new Image();
  svImage.onload = () => {
    svImageReady = true;
  };
  svImage.src = "./assets/images/SV.jpeg";
}

function drawSvImage(time, delta) {
  if (!svImageReady || !svAnchorElement) {
    return;
  }

  const imageSize = Math.min(width < 720 ? width * 1.08 : width * 0.68, 980);
  const floatY = reduceMotion ? 0 : Math.sin(time * 0.00016) * 8;
  const anchor = svAnchorElement.getBoundingClientRect();
  const targetX = width < 720 ? width * 0.7 : Math.min(width - imageSize * 0.18, anchor.right + imageSize * 0.34);
  const targetY = anchor.top + anchor.height * 0.48 + floatY;
  const visibleTop = -imageSize * 0.36;
  const visibleBottom = height + imageSize * 0.36;
  const targetOpacity =
    smoothstep(visibleTop, visibleTop + imageSize * 0.42, targetY) *
    (1 - smoothstep(visibleBottom - imageSize * 0.42, visibleBottom, targetY)) *
    0.44;
  const follow = reduceMotion ? 1 : 1 - Math.pow(0.84, delta);
  const fade = reduceMotion ? 1 : 1 - Math.pow(0.82, delta);

  if (svX === 0 && svY === 0) {
    svX = targetX;
    svY = targetY;
  }

  svX += (targetX - svX) * follow;
  svY += (targetY - svY) * follow;
  svOpacity += (targetOpacity - svOpacity) * fade;

  ctx.save();
  ctx.globalAlpha = svOpacity;
  ctx.translate(svX, svY);
  ctx.rotate(((svY - height * 0.5) / Math.max(height, 1)) * 0.025);
  ctx.drawImage(svImage, -imageSize / 2, -imageSize / 2, imageSize, imageSize);
  ctx.restore();
}

function getScrollState() {
  return {
    top: smoothScrollTop,
    progress: Math.min(Math.max(smoothScrollTop / scrollMax, 0), 1),
  };
}

function updateScrollTarget() {
  targetScrollTop = window.scrollY || document.documentElement.scrollTop || 0;
  scrollMax = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
}

function updateSmoothScroll(delta) {
  const follow = reduceMotion ? 1 : 1 - Math.pow(0.86, delta);
  smoothScrollTop += (targetScrollTop - smoothScrollTop) * follow;
}

function smoothstep(edge0, edge1, value) {
  const x = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);
  return x * x * (3 - 2 * x);
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
