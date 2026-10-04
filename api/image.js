export default async function handler(req, res) {
  const { url, title } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const fallbackToLogo = (finalUrl) => {
    try {
      if (finalUrl) {
        const hostname = new URL(finalUrl).hostname;
        return res.redirect(302, `https://www.google.com/s2/favicons?domain=${hostname}&sz=256`);
      }
    } catch(e) {}
    
    // Ultimate fallback if even URL parsing fails
    if (title) {
       const promptWords = title.replace(/[^a-zA-Z0-9 ]/g, '').split(' ').slice(0, 8).join(' ');
       const aiUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptWords + ' news high quality photography')}?width=800&height=500&nologo=true`;
       return res.redirect(302, aiUrl);
    }
    return res.redirect(302, 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800&q=80');
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    
    // Fetch the target URL. fetch automatically follows redirects (like Google News RSS links).
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    const html = await response.text();
    
    // Attempt to extract og:image or twitter:image
    const match = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i) || 
                  html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:image"/i) ||
                  html.match(/<meta[^>]*name="twitter:image"[^>]*content="([^"]+)"/i) ||
                  html.match(/<meta[^>]*content="([^"]+)"[^>]*name="twitter:image"/i);
    
    if (match && match[1]) {
      // Decode entities like &amp; just in case
      const imageUrl = match[1].replace(/&amp;/g, '&');
      
      // Set extremely aggressive Cache-Control header since article images never change
      res.setHeader('Cache-Control', 'public, s-maxage=31536000, max-age=31536000, immutable');
      
      // Redirect the browser to the actual image URL so the browser caches it natively
      return res.redirect(302, imageUrl);
    } else {
      return fallbackToLogo(response.url);
    }
  } catch (error) {
    console.warn('Image proxy error:', error.message);
    return fallbackToLogo();
  }
}
