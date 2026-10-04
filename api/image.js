export default async function handler(req, res) {
  const { url, title } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const fallbackToSvgLogo = (finalUrl) => {
    let publisher = 'NEWS SOURCE';
    try {
      if (finalUrl) {
        publisher = new URL(finalUrl).hostname.replace(/^www\./i, '');
      }
    } catch(e) {}
    
    // Generate a sleek, high-tech SVG banner that scales infinitely (0 blurriness)
    const svg = `
      <svg width="800" height="500" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#090A0F;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#161b22;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad)" />
        <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="#00F0FF" font-family="sans-serif" font-size="46" font-weight="900" letter-spacing="2">${publisher.toUpperCase()}</text>
        <text x="50%" y="60%" dominant-baseline="middle" text-anchor="middle" fill="#888888" font-family="sans-serif" font-size="18" letter-spacing="4">VERIFIED NEWS SOURCE</text>
      </svg>
    `;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, s-maxage=31536000, max-age=31536000, immutable');
    return res.status(200).send(svg.trim());
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    const html = await response.text();
    
    const match = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i) || 
                  html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:image"/i) ||
                  html.match(/<meta[^>]*name="twitter:image"[^>]*content="([^"]+)"/i) ||
                  html.match(/<meta[^>]*content="([^"]+)"[^>]*name="twitter:image"/i);
    
    if (match && match[1]) {
      const imageUrl = match[1].replace(/&amp;/g, '&');
      res.setHeader('Cache-Control', 'public, s-maxage=31536000, max-age=31536000, immutable');
      return res.redirect(302, imageUrl);
    } else {
      return fallbackToSvgLogo(response.url);
    }
  } catch (error) {
    console.warn('Image proxy error:', error.message);
    return fallbackToSvgLogo();
  }
}
