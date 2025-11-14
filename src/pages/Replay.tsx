import { useEffect, useMemo, useRef, useState } from 'react';
import type { eventWithTime } from '@rrweb/types';
import RRWebPlayer from 'rrweb-player';

type Recording = {
  id: string;
  name: string;
  createdAt: number;
  events: eventWithTime[];
};

const STORAGE_KEY = 'rrweb-recordings';

export default function Replay() {
  const [recordings, setRecordings] = useState<Recording[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [activeId, setActiveId] = useState<string | null>(
    recordings[0]?.id ?? null
  );
  const playerMountRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    // 每次进入页面刷新一次列表（避免外部新增）
    const saved = localStorage.getItem(STORAGE_KEY);
    setRecordings(saved ? JSON.parse(saved) : []);
  }, []);

  // 将列表写回本地存储
  const writeRecordings = (list: Recording[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  };

  // 删除某条录制
  const handleDelete = (id: string) => {
    setRecordings((prev) => {
      const next = prev.filter((r) => r.id !== id);
      writeRecordings(next);
      if (activeId === id) {
        setActiveId(next[0]?.id ?? null);
      }
      return next;
    });
  };

  // 清空所有录制
  const handleClear = () => {
    writeRecordings([]);
    setRecordings([]);
    setActiveId(null);
  };

  const active = useMemo(
    () => recordings.find((r) => r.id === activeId) || null,
    [activeId, recordings]
  );

  // 提取接口事件（源于 axios 拦截器的自定义事件）
  const httpEvents = useMemo(() => {
    if (!active) return [];
    const events = active.events as any[];
    return events
      .filter((e) => e?.data && typeof e.data.tag === 'string')
      .filter((e) =>
        ['http-request', 'http-response', 'http-error'].includes(e.data.tag)
      )
      .map((e) => ({
        tag: e.data.tag as 'http-request' | 'http-response' | 'http-error',
        payload: e.data.payload || {},
        timestamp: e.timestamp as number,
      }));
  }, [active]);

  useEffect(() => {
    if (!playerMountRef.current) return;
    playerMountRef.current.innerHTML = '';
    playerRef.current = null;
    if (!active) return;

    const container = document.createElement('div');
    container.className = 'rr-block';
    playerMountRef.current.appendChild(container);

    // @ts-ignore: rrweb-player 类型声明在 src/types/rrweb-player.d.ts
    const player = new RRWebPlayer({
      target: container,
      props: {
        events: active.events,
        width: 960,
        height: 360,
        autoPlay: false,
        UNSAFE_replayCanvas: true,
        tags: {
          'http-request': '#1677ff',
          'http-response': '#52c41a',
          'http-error': '#ff4d4f',
        },
      },
    });
    playerRef.current = player;

    return () => {
      playerMountRef.current && (playerMountRef.current.innerHTML = '');
      playerRef.current = null;
    };
  }, [active]);

  // 将同一 requestId 的请求/响应聚合展示
  const httpGroups = useMemo(() => {
    const map = new Map<
      number,
      { request?: any; response?: any; error?: any }
    >();
    for (const ev of httpEvents) {
      const id = ev.payload.requestId ?? -1;
      const g = map.get(id) || {};
      if (ev.tag === 'http-request') g.request = ev;
      if (ev.tag === 'http-response') g.response = ev;
      if (ev.tag === 'http-error') g.error = ev;
      map.set(id, g);
    }
    // 过滤无有效 id 的项
    return Array.from(map.entries())
      .filter(([id]) => id !== -1)
      .map(([id, g]) => ({ id, ...g }))
      .sort(
        (a, b) => (a.request?.timestamp || 0) - (b.request?.timestamp || 0)
      );
  }, [httpEvents]);

  const gotoEvent = (ts: number) => {
    if (!active || !playerRef.current) return;
    const startTs = (active.events[0] as any)?.timestamp ?? ts;
    const offset = Math.max(0, ts - startTs);
    // @ts-ignore
    playerRef.current.goto(offset, true);
  };

  return (
    <section className="replay-page">
      <h1>回放列表</h1>
      <button
        onClick={handleClear}
        disabled={recordings.length === 0}
        style={{ marginBottom: 8 }}
      >
        清空全部
      </button>
      <ul className="list">
        {recordings.length === 0 && <li>暂无录制数据</li>}
        {recordings.map((r) => (
          <li
            key={r.id}
            onClick={() => setActiveId(r.id)}
            className={activeId === r.id ? 'active' : ''}
            title={`${new Date(r.createdAt).toLocaleString()} · ${
              r.events.length
            } events`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="name">{r.name}</span>
              <span className="meta">
                {new Date(r.createdAt).toLocaleString()} · {r.events.length}{' '}
                events
              </span>
            </div>
            {/* 新增删除按钮 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(r.id);
              }}
              style={{ width: 60, height: 30 }}
            >
              删除
            </button>
          </li>
        ))}
      </ul>

      {/* 接口事件信息展示 */}
      {active && (
        <div style={{ marginBottom: 12 }}>
          <h3>接口事件</h3>
          {httpGroups.length === 0 && <p>本次录制未捕获到接口事件。</p>}
          {httpGroups.map((g, i) => {
            const req = g.request?.payload || {};
            const res = g.response?.payload || {};
            const err = g.error?.payload || null;
            return (
              <div
                key={i}
                style={{
                  padding: 10,
                  border: '1px solid #333',
                  borderRadius: 8,
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  }}
                >
                  <strong>
                    #{g.id} {req.method?.toUpperCase?.() || '-'}{' '}
                    {req.url || '-'}
                  </strong>
                  <span style={{ color: '#999' }}>
                    {g.request &&
                      new Date(g.request.timestamp).toLocaleTimeString()}
                    {g.response &&
                      ` → ${new Date(
                        g.response.timestamp
                      ).toLocaleTimeString()}`}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 12,
                    flexWrap: 'wrap',
                    marginBottom: 8,
                  }}
                >
                  {g.request && (
                    <button onClick={() => gotoEvent(g.request.timestamp)}>
                      跳到请求
                    </button>
                  )}
                  {g.response && (
                    <button onClick={() => gotoEvent(g.response.timestamp)}>
                      跳到响应
                    </button>
                  )}
                  {g.error && (
                    <button onClick={() => gotoEvent(g.error.timestamp)}>
                      跳到错误
                    </button>
                  )}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                      请求头
                    </div>
                    <pre style={{ whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(req.headers ?? {}, null, 2)}
                    </pre>
                    <div style={{ fontWeight: 600, margin: '8px 0 4px' }}>
                      请求体（{req.bodySize ?? 0} bytes）
                    </div>
                    <pre style={{ whiteSpace: 'pre-wrap' }}>
                      {String(req.body ?? '')}
                    </pre>
                  </div>

                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                      响应头{' '}
                      {res.status
                        ? `(状态 ${res.status})`
                        : err
                        ? `(状态 ${err.status ?? 'ERROR'})`
                        : ''}
                    </div>
                    <pre style={{ whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(
                        res.headers ?? err?.headers ?? {},
                        null,
                        2
                      )}
                    </pre>
                    <div style={{ fontWeight: 600, margin: '8px 0 4px' }}>
                      响应体（{res.bodySize ?? err?.bodySize ?? 0} bytes）
                    </div>
                    <pre style={{ whiteSpace: 'pre-wrap' }}>
                      {String(res.body ?? err?.body ?? '')}
                    </pre>
                  </div>
                </div>

                {(res.durationMs != null || res.perf) && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontWeight: 600 }}>耗时与性能</div>
                    <pre style={{ whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(
                        {
                          durationMs: res.durationMs,
                          perf: res.perf,
                        },
                        null,
                        2
                      )}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="player" ref={playerMountRef} />
    </section>
  );
}
