import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, X, Download, Copy, Check, Loader2 } from 'lucide-react';
import type { LiveArticle } from '../utils/liveNews';
import { downloadNewsCard } from '../utils/downloadNewsCard';

interface Props {
  article: LiveArticle;
  themeColor?: string;
}

const SOCIALS = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    color: '#25D366',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
    ),
    getUrl: (title: string, link: string) =>
      `https://api.whatsapp.com/send?text=${encodeURIComponent(`📰 ${title}\n\nRead more: ${link}\n\n— Extraordinary News ⚡`)}`,
  },
  {
    id: 'twitter',
    label: 'X / Twitter',
    color: '#1DA1F2',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.261 5.632L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    getUrl: (title: string, link: string) =>
      `https://x.com/intent/tweet?text=${encodeURIComponent(`📰 ${title}`)}&url=${encodeURIComponent(link)}&via=ExtraordinaryNews`,
  },
  {
    id: 'facebook',
    label: 'Facebook',
    color: '#1877F2',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
    getUrl: (_: string, link: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`,
  },
  {
    id: 'telegram',
    label: 'Telegram',
    color: '#2CA5E0',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
    ),
    getUrl: (title: string, link: string) =>
      `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(`📰 ${title}`)}`,
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    color: '#0A66C2',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
    getUrl: (title: string, link: string) =>
      `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(link)}&title=${encodeURIComponent(title)}`,
  },
  {
    id: 'instagram',
    label: 'Instagram',
    color: '#E1306C',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
      </svg>
    ),
    // Instagram has no web share URL — copy text to clipboard instead
    getUrl: null,
  },
];

export default function ShareMenu({ article, themeColor = '#00F0FF' }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const shareLink = article.link !== '#' ? article.link : window.location.href;

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: article.title,
          text: `📰 ${article.title}\n\n${article.summary}`,
          url: shareLink,
        });
        return;
      } catch {}
    }
    setOpen(true);
  };

  const handleSocial = (social: typeof SOCIALS[0]) => {
    if (social.getUrl) {
      window.open(social.getUrl(article.title, shareLink), '_blank', 'noopener,noreferrer');
    } else {
      // Instagram: copy to clipboard
      const text = `📰 ${article.title}\n\n${article.summary}\n\n${shareLink}\n\n— Extraordinary News ⚡`;
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadNewsCard(article);
    } catch (e) {
      console.error('Download failed', e);
    }
    setDownloading(false);
  };

  return (
    <div className="relative">
      {/* Share trigger button */}
      <button
        onClick={handleNativeShare}
        className="flex justify-center items-center gap-1 md:gap-2 px-2 md:px-4 py-2 md:py-2.5 rounded-lg md:rounded-xl font-bold text-xs md:text-sm bg-white/5 hover:bg-white/10 transition-all"
        title="Share"
      >
        <Share2 size={14} className="md:w-4 md:h-4" /> Share
      </button>

      {/* Fallback modal for desktop */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ type: 'spring', damping: 22, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 sm:absolute sm:bottom-auto sm:top-auto sm:left-auto sm:right-0 sm:mt-2 z-[201] w-full sm:w-80 bg-[#13151f] border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-[0_0_60px_rgba(0,240,255,0.15)] p-5"
              style={{ '--tw-ring-color': themeColor } as any}
            >
              {/* Header */}
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-black text-white text-base uppercase tracking-widest flex items-center gap-2">
                  <Share2 size={16} style={{ color: themeColor }} /> Share Story
                </h3>
                <button onClick={() => setOpen(false)} className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-gray-400">
                  <X size={16} />
                </button>
              </div>

              {/* Title preview */}
              <p className="text-xs text-gray-400 font-mono mb-4 leading-relaxed line-clamp-2 border-l-2 pl-3" style={{ borderColor: themeColor }}>
                {article.title}
              </p>

              {/* Social grid */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {SOCIALS.map(s => (
                  <button
                    key={s.id}
                    onClick={() => handleSocial(s)}
                    className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-white group"
                  >
                    <span style={{ color: s.color }} className="group-hover:scale-110 transition-transform">
                      {s.icon}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 group-hover:text-white transition-colors">
                      {s.id === 'instagram' ? (copied ? '✓ Copied!' : 'Instagram') : s.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Divider */}
              <div className="border-t border-white/5 my-3" />

              {/* Copy link */}
              <button
                onClick={handleCopyLink}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-white mb-2"
              >
                {copied ? <Check size={16} style={{ color: themeColor }} /> : <Copy size={16} className="text-gray-400" />}
                <span className="text-sm font-bold">{copied ? 'Link Copied!' : 'Copy Link'}</span>
              </button>

              {/* Download JPEG */}
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-black text-sm text-black transition-all hover:opacity-90 disabled:opacity-60"
                style={{ background: `linear-gradient(135deg, ${themeColor}, #FF2E93)` }}
              >
                {downloading
                  ? <Loader2 size={16} className="animate-spin" />
                  : <Download size={16} />}
                {downloading ? 'Generating...' : 'Download as JPEG'}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
