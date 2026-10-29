import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, FilePenLine } from 'lucide-react';
import originals from '../content/original-library.json';
import { useInstalledBook, type Book } from './Textbooks';
import { message, saveFile } from './platform';
import type { Article } from './model';
import './originalReader.css';

export function OriginalBookReader({ book: source, articles, section }: { book: Book; articles: Article[]; section: string }) {
  const book = useInstalledBook(source, articles);
  const frame = useRef<HTMLIFrameElement>(null);
  const cleanup = useRef<() => void>(() => {});
  const [notice, setNotice] = useState('');
  const [activeAnchor, setActiveAnchor] = useState('book-mastery');
  const [ready, setReady] = useState(false);
  const [resource, setResource] = useState<{ name: string; text: string; data: Blob } | null>(null);
  const original = originals.books.find(b => b.id === book.id)!;
  const base = new URL('./original-library/', location.href);
  const currentId = book.chapters.find(c => c.anchor === activeAnchor)?.id || book.overviewId;
  const files = new Map(originals.files.map(file => [file.path, file]));
  useEffect(() => () => cleanup.current(), []);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const back = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (resource) { setResource(null); return; }
      const win = frame.current?.contentWindow as (Window & { MobileReader?: { handleBack: () => boolean } }) | null;
      if (!win?.MobileReader?.handleBack()) location.hash = `shelf/${book.shelfId}`;
    };
    window.addEventListener('zhizhan:back', back, true);
    return () => { document.body.style.overflow = previous; window.removeEventListener('zhizhan:back', back, true); };
  }, [book.shelfId, resource]);

  async function openResource(relative: string, download: boolean) {
    try {
      setNotice('正在读取配套资料…');
      const alias = (originals.downloads as Record<string, string>)[relative] || relative;
      const response = await fetch(new URL(alias, base));
      if (!response.ok) throw Error('配套资料读取失败');
      const data = await response.blob();
      const expected = files.get(relative);
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await data.arrayBuffer()))]
        .map(b => b.toString(16).padStart(2, '0')).join('');
      if (!expected || hash !== expected.sha256) throw Error('配套资料校验失败，请重新安装当前版本');
      const name = relative.split('/').at(-1)!;
      if (download || /\.(zip|png|jpe?g|pdf|webp)$/i.test(name)) {
        await saveFile(name, data);
        setNotice('资料已交给系统保存');
      } else { setResource({ name, text: await data.text(), data }); setNotice(''); }
    } catch (error) { setNotice(message(error)); }
  }

  function loaded() {
    cleanup.current();
    const win = frame.current?.contentWindow, doc = frame.current?.contentDocument;
    if (!win || !doc?.getElementById('mMain')) {
      setNotice('原册未能打开，请返回课程后重试。');
      return;
    }
    setReady(true);
    const layout = doc.createElement('style');
    layout.textContent = '@media(min-width:900px) and (min-height:600px){.m-drawer{width:var(--m-rail)!important}}';
    doc.head.append(layout);
    // Only the outer application chrome changes. The original page on disk is
    // untouched, with its own layout, directory, code, figures and disclosures.
    const selectChapter = () => {
      const sections = [...doc.querySelectorAll<HTMLElement>('.learning-plan[id],.chapter[id],.reader-chapter[id]')];
      let active = sections[0]?.id || 'book-mastery';
      const top = (doc.getElementById('mHeader')?.getBoundingClientRect().bottom || 0) + 40;
      for (const node of sections) {
        if (node.getBoundingClientRect().top <= top) active = node.id;
        else break;
      }
      setActiveAnchor(active);
    };
    let timer: ReturnType<typeof setTimeout>;
    const scroll = () => { clearTimeout(timer); timer = setTimeout(selectChapter, 120); };
    const click = (event: MouseEvent) => {
      const link = (event.target as Element).closest<HTMLAnchorElement>('a[href]');
      if (!link) return;
      const url = new URL(link.href);
      if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return;
      const relative = decodeURIComponent(url.pathname.slice(base.pathname.length));
      if (url.pathname === new URL(original.path, base).pathname && url.hash) return;
      const other = originals.books.find(b => b.path === relative);
      if (other) {
        event.preventDefault(); event.stopImmediatePropagation();
        location.hash = `original/${other.shelfId}${url.hash ? `?section=${encodeURIComponent(decodeURIComponent(url.hash.slice(1)))}` : ''}`;
      } else if (relative === 'index.html') {
        event.preventDefault(); event.stopImmediatePropagation(); location.hash = 'courses';
      } else if (relative.endsWith('.html')) {
        // Supporting project pages are available in the native learning guide.
        event.preventDefault(); event.stopImmediatePropagation();
        const article = relative.includes('learning-path') ? 'course-learning-path'
          : relative.includes('quality-review') ? 'course-quality-review' : 'course-projects';
        location.hash = `article/${article}${url.hash ? `?section=${encodeURIComponent(url.hash.slice(1))}` : ''}`;
      } else if (files.has(relative)) {
        event.preventDefault(); event.stopImmediatePropagation();
        void openResource(relative, link.hasAttribute('download'));
      }
    };
    doc.addEventListener('click', click, true);
    win.addEventListener('scroll', scroll, { passive: true });
    selectChapter();
    cleanup.current = () => { clearTimeout(timer); doc.removeEventListener('click', click, true); win.removeEventListener('scroll', scroll); };
  }
  return <section className="original-reader" aria-label={`${book.name} · 原版整册`}>
    <header className="original-reader-bar">
      <a href={`#shelf/${book.shelfId}`} className="button quiet"><ArrowLeft size={18} /><span>课程目录</span></a>
      <div><strong>{book.name}</strong><small>原版整册 · 离线阅读</small></div>
      <a href={`#article/${currentId}`} className="button quiet"><FilePenLine size={18} /><span>分章与笔记</span></a>
    </header>
    {!ready && <p className="original-reader-loading" role="status">正在打开原版整册…</p>}
    <iframe ref={frame} title={`${book.name}原版完整正文`}
      src={`${base.pathname}${original.path}${section ? `#${encodeURIComponent(section)}` : ''}`}
      onLoad={loaded} sandbox="allow-scripts allow-same-origin allow-downloads allow-popups" />
    {notice && <div className="original-reader-notice" role="status">{notice}<button onClick={() => setNotice('')}>关闭</button></div>}
    {resource && <div className="original-resource" role="dialog" aria-modal="true" aria-label={resource.name}>
      <header><strong>{resource.name}</strong><button onClick={() => void saveFile(resource.name, resource.data).catch(e => setNotice(message(e)))}>保存文件</button><button onClick={() => setResource(null)}>关闭源码</button></header>
      <pre>{resource.text}</pre>
    </div>}
  </section>;
}
