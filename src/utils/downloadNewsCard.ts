import type { LiveArticle } from './liveNews';

/** Loads an image returning an HTMLImageElement (with CORS fallback) */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      // Fallback: try without crossOrigin
      const img2 = new Image();
      img2.onload = () => resolve(img2);
      img2.onerror = () => resolve(img2); // resolve anyway, we'll draw bg only
      img2.src = src;
    };
    img.src = src;
  });
}

/** Wrap text across multiple lines on a canvas */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  for (const word of words) {
    const test = line + word + ' ';
    if (ctx.measureText(test).width > maxWidth && line !== '') {
      ctx.fillText(line.trim(), x, currentY);
      currentY += lineHeight;
      line = word + ' ';
    } else {
      line = test;
    }
  }
  if (line.trim()) ctx.fillText(line.trim(), x, currentY);
  return currentY;
}

export async function downloadNewsCard(article: LiveArticle): Promise<void> {
  const W = 1080;
  const H = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // ── 1. Background image ──────────────────────────────────────────────────
  try {
    const img = await loadImage(article.image);
    if (img.naturalWidth > 0) {
      // Cover-fit the image
      const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      const sw = img.naturalWidth * scale;
      const sh = img.naturalHeight * scale;
      ctx.drawImage(img, (W - sw) / 2, (H - sh) / 2, sw, sh);
    } else {
      ctx.fillStyle = '#090A0F';
      ctx.fillRect(0, 0, W, H);
    }
  } catch {
    ctx.fillStyle = '#090A0F';
    ctx.fillRect(0, 0, W, H);
  }

  // ── 2. Dark gradient overlay ─────────────────────────────────────────────
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(9,10,15,0.55)');
  grad.addColorStop(0.35, 'rgba(9,10,15,0.15)');
  grad.addColorStop(0.65, 'rgba(9,10,15,0.25)');
  grad.addColorStop(1, 'rgba(9,10,15,0.97)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // ── 3. Top branding bar ──────────────────────────────────────────────────
  ctx.fillStyle = '#FF2E93';
  ctx.fillRect(0, 0, W, 88);

  // Accent line
  ctx.fillStyle = '#00F0FF';
  ctx.fillRect(0, 84, W, 4);

  // Logo text
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 38px Arial, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚡ EXTRAORDINARY NEWS', 32, 44);

  // Live dot + LIVE badge on right
  ctx.fillStyle = '#00F0FF';
  ctx.beginPath();
  ctx.arc(W - 120, 40, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = 'bold 26px Arial, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('LIVE', W - 100, 44);

  // ── 4. Source chip ───────────────────────────────────────────────────────
  const sourceText = article.source.toUpperCase();
  ctx.font = 'bold 22px Arial, sans-serif';
  const sourceW = ctx.measureText(sourceText).width + 32;
  ctx.fillStyle = '#00F0FF';
  roundRect(ctx, 36, H - 320, sourceW, 40, 8);
  ctx.fill();
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'middle';
  ctx.fillText(sourceText, 52, H - 300);

  // ── 5. Headline ──────────────────────────────────────────────────────────
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 54px Arial, sans-serif';
  ctx.textBaseline = 'top';
  const lastY = wrapText(ctx, article.title, 36, H - 260, W - 72, 68);

  // ── 6. Summary snippet ───────────────────────────────────────────────────
  const snippet = article.summary.replace(/\.\.\.$/, '').substring(0, 120) + '...';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '28px Arial, sans-serif';
  wrapText(ctx, snippet, 36, lastY + 20, W - 72, 40);

  // ── 7. Bottom bar with date + watermark ──────────────────────────────────
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, H - 56, W, 56);

  const dateStr = new Date(article.pubDate || Date.now()).toLocaleDateString('en-US', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
  });
  ctx.fillStyle = '#00F0FF';
  ctx.font = 'bold 22px Arial, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(dateStr, 32, H - 28);

  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '20px Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('extraordinary-news.vercel.app', W - 32, H - 28);
  ctx.textAlign = 'left';

  // ── 8. Download ──────────────────────────────────────────────────────────
  canvas.toBlob(
    blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `extraordinary-news-${Date.now()}.jpg`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    },
    'image/jpeg',
    0.92
  );
}

/** Helper: draw a rounded rectangle path */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
