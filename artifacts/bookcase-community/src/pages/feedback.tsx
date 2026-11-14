import { useRef, useState } from 'react';
import type { ReactNode, SVGProps } from 'react';
import './feedback.css';

/**
 * Layout prototype for the community feedback page.
 * The B/C switch and vote counts stay on this page.
 * Nothing is collected, stored, or submitted.
 */

type Tag = { label: string; ok?: boolean };

type FeedPost = {
  id: string;
  votes: number;
  name: string;
  when: string;
  tags: Tag[];
  title: string;
  excerpt: string;
  comments: number;
};

type ListRow = {
  id: string;
  votes: number;
  title: string;
  detail: string;
  author: string;
  active: string;
};

const FEED: FeedPost[] = [
  {
    id: 'drafts',
    votes: 86,
    name: 'Anonymous',
    when: '2h ago',
    tags: [{ label: 'Discovery' }, { label: 'Popular', ok: true }],
    title: 'Let me save and compare multiple shelf drafts',
    excerpt: 'I want to keep version A and B, then quickly flip between them without losing changes.',
    comments: 28,
  },
  {
    id: 'mobile-steps',
    votes: 61,
    name: 'Lila M.',
    when: '5h ago',
    tags: [{ label: 'Mobile' }],
    title: 'Mobile layout should keep build steps pinned',
    excerpt: 'On phone, I lose context while scrolling. A bottom step tracker would help a lot.',
    comments: 11,
  },
  {
    id: 'public-link',
    votes: 34,
    name: 'Anonymous',
    when: '1d ago',
    tags: [{ label: 'Sharing' }],
    title: 'Public link for my setup with comments on shelves',
    excerpt: 'Let me share a link where friends can click each shelf and leave suggestions.',
    comments: 7,
  },
];

const LIST: ListRow[] = [
  {
    id: 'templates',
    votes: 112,
    title: 'Template library for starter shelf styles',
    detail: 'Auto-apply a style pack in one click',
    author: 'Anonymous',
    active: '1h ago',
  },
  {
    id: 'rooms',
    votes: 89,
    title: 'Find ideas by room type',
    detail: 'Living room, office, kids room, studio',
    author: 'Rico P.',
    active: '4h ago',
  },
  {
    id: 'dimensions',
    votes: 73,
    title: 'Show dimensions live while arranging shelves',
    detail: 'Always-on size overlay for confidence before build',
    author: 'Anonymous',
    active: '7h ago',
  },
  {
    id: 'profiles',
    votes: 51,
    title: 'Community profile pages with saved setups',
    detail: 'Optional profile for creators who want attribution',
    author: 'Sam C.',
    active: '1d ago',
  },
];

function StrokeIcon({ size = 18, children, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

function PlusIcon() {
  return <StrokeIcon size={16}><path d="M12 5v14M5 12h14" /></StrokeIcon>;
}

function UpIcon() {
  return <StrokeIcon size={14}><path d="M12 19V5M6 11l6-6 6 6" /></StrokeIcon>;
}

function TagList({ tags }: { tags: Tag[] }) {
  return (
    <>
      {tags.map((tag) => (
        <span key={tag.label} className={tag.ok ? 'feedback-tag is-ok' : 'feedback-tag'}>{tag.label}</span>
      ))}
    </>
  );
}

export default function FeedbackPage({ header }: { header: ReactNode }) {
  const [layout, setLayout] = useState<'b' | 'c'>('c');
  const [feedVotes, setFeedVotes] = useState(() => FEED.map((post) => post.votes));
  const [listVotes, setListVotes] = useState(() => LIST.map((row) => row.votes));
  const composerTitle = useRef<HTMLInputElement>(null);
  const quickTitle = useRef<HTMLInputElement>(null);

  function showComposer() {
    const field = layout === 'b' ? composerTitle.current : quickTitle.current;
    field?.focus();
    field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function bumpFeed(index: number) {
    setFeedVotes((current) => current.map((votes, i) => (i === index ? votes + 1 : votes)));
  }

  function bumpList(index: number) {
    setListVotes((current) => current.map((votes, i) => (i === index ? votes + 1 : votes)));
  }

  return (
    <div className="tw-shell">
      {header}
      <main className="feedback-page">
        <div className="feedback-toolbar">
          <button className="button light" type="button" onClick={showComposer}>
            <PlusIcon />
            Add idea
          </button>
        </div>

        <section className="feedback-hero">
          <h1>Make a wish.</h1>
          <p className="feedback-sub">Got an idea? Share it. Vote on it. We'll read it.</p>
        </section>

        <div className="feedback-switch" role="group" aria-label="Feedback layout">
          <button type="button" aria-pressed={layout === 'b'} onClick={() => setLayout('b')}>Version B · Feed + sticky composer</button>
          <button type="button" aria-pressed={layout === 'c'} onClick={() => setLayout('c')}>Version C · Compact forum list</button>
        </div>

        {layout === 'b' ? (
          <section className="feedback-board" aria-label="Version B, feed and composer">
            <div className="feedback-split">
              <div className="feedback-feed">
                {FEED.map((post, index) => (
                  <article className="feedback-post" key={post.id}>
                    <div className="feedback-vote">
                      <button type="button" aria-label={`Upvote ${post.title}`} onClick={() => bumpFeed(index)}>
                        <UpIcon />
                      </button>
                      <b>{feedVotes[index]}</b>
                    </div>
                    <div>
                      <div className="feedback-meta">
                        <span className="feedback-name">{post.name}</span>
                        <span>{post.when}</span>
                        <TagList tags={post.tags} />
                      </div>
                      <h2 className="feedback-title">{post.title}</h2>
                      <p className="feedback-excerpt">{post.excerpt}</p>
                      <div className="feedback-actions">
                        <button type="button">{post.comments} comments</button>
                        <button type="button">Follow</button>
                        <button type="button">Share</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <aside className="feedback-composer">
                <h3>Add your feedback</h3>
                <input ref={composerTitle} type="text" defaultValue="I wish there was..." aria-label="Idea title" autoComplete="off" />
                <textarea aria-label="Feedback details" defaultValue="I would love to see this because..." />
                <div className="feedback-row">
                  <select aria-label="Category" defaultValue="Feature request">
                    <option>Feature request</option>
                    <option>UX improvement</option>
                    <option>Bug report</option>
                    <option>Community idea</option>
                  </select>
                </div>
                <label className="feedback-check" htmlFor="anonymous-b">
                  <input id="anonymous-b" type="checkbox" defaultChecked />
                  <span>Post as Anonymous</span>
                </label>
                <p className="feedback-note">You are logged in for moderation and safety, but your name can stay hidden from the community.</p>
                <button className="button coral feedback-share" type="button">Share feedback</button>
              </aside>
            </div>
          </section>
        ) : (
          <section className="feedback-board" aria-label="Version C, compact forum list">
            <div className="feedback-stack">
              <div className="feedback-panel">
                <h3>Quick post</h3>
                <div className="feedback-row feedback-quick">
                  <input ref={quickTitle} type="text" defaultValue="Short request title" aria-label="Short request title" autoComplete="off" />
                  <button className="button coral" type="button">Post</button>
                </div>
                <div className="feedback-row">
                  <label className="feedback-check" htmlFor="anonymous-c">
                    <input id="anonymous-c" type="checkbox" defaultChecked />
                    <span>Post as Anonymous</span>
                  </label>
                  <span className="feedback-note">Login required for posting and voting.</span>
                </div>
              </div>

              <div className="feedback-table">
                <h3>Top community requests</h3>
                <div className="feedback-head" aria-hidden="true">
                  <div>Votes</div>
                  <div>Idea</div>
                  <div className="feedback-hide-narrow">Author</div>
                  <div className="feedback-hide-narrow">Last active</div>
                </div>
                {LIST.map((row, index) => (
                  <div className="feedback-line" key={row.id}>
                    <div>
                      <button className="feedback-upvote" type="button" aria-label={`Upvote ${row.title}`} onClick={() => bumpList(index)}>
                        <UpIcon />
                        {listVotes[index]}
                      </button>
                    </div>
                    <div>
                      <div><strong>{row.title}</strong></div>
                      <div className="feedback-kicker">{row.detail}</div>
                    </div>
                    <div className="feedback-hide-narrow">{row.author}</div>
                    <div className="feedback-hide-narrow feedback-muted">{row.active}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
