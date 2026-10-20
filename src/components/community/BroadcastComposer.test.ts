import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BroadcastExtrasEditor, BroadcastResults } from './BroadcastComposer';

const noop = () => {};

describe('BroadcastExtrasEditor', () => {
  it('shows poll options, the replies switch and a link action', () => {
    const html = renderToStaticMarkup(createElement(BroadcastExtrasEditor, {
      draft: { pollOptions: ['Classic', 'New look'], allowReplies: true, action: { kind: 'link', label: 'Read more', url: '' } },
      disabled: false,
      onChange: noop,
    }));
    expect(html).toContain('value="Classic"');
    expect(html).toContain('value="New look"');
    expect(html).toContain('Add option');
    expect(html).toContain('aria-label="Allow private replies"');
    expect(html).toContain('Only YouDO on GitHub or Telegram');
  });
});

describe('BroadcastResults', () => {
  it('shows votes, reactions and private replies with names', () => {
    const html = renderToStaticMarkup(createElement(BroadcastResults, {
      state: {
        revision: 3,
        poll: { options: ['Classic', 'New look'], closed: false, myChoice: null, counts: [1, 3], total: 4 },
        reactions: { '🔥': 2 },
        myReaction: null,
        replies: true,
        replied: false,
        action: null,
      },
      replies: [{ userId: 'u1', body: 'Love the new look', createdAt: '' }],
      names: new Map([['u1', 'Asha']]),
      busy: false,
      onEndPoll: noop,
    }));
    expect(html).toContain('1 · 25%');
    expect(html).toContain('3 · 75%');
    expect(html).toContain('End poll');
    expect(html).toContain('🔥 2');
    expect(html).toContain('Private replies (1)');
    expect(html).toContain('Asha');
    expect(html).toContain('Love the new look');
  });

  it('stays hidden for a plain update', () => {
    expect(renderToStaticMarkup(createElement(BroadcastResults, {
      state: { revision: 1, poll: null, reactions: {}, myReaction: null, replies: false, replied: false, action: null },
      replies: [], names: new Map(), busy: false, onEndPoll: noop,
    }))).toBe('');
  });
});
