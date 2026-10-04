export default async function handler(req, res) {
  const url = req.query.url;
  
  if (!url) {
    return res.status(400).send('Missing url parameter');
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      }
    });
    
    const text = await response.text();
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/xml');
    res.status(response.status).send(text);
  } catch (error) {
    console.error('Proxy error:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).send(error.toString());
  }
}
