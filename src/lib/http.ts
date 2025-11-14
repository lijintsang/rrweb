import axios, { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from 'axios';
import { record } from 'rrweb';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const instance = axios.create({
  baseURL: '/',
  timeout: 5000
});

// 保存原始适配器以便非 mock 请求走默认逻辑
const defaultAdapter = axios.defaults.adapter as AxiosAdapter;

// 将对象转纯对象
const toPlainObject = (obj: any) => {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return obj;
  }
};

// 计算字节大小
const byteSize = (value: any) => {
  try {
    if (value == null) return 0;
    if (typeof value === 'string') return new TextEncoder().encode(value).length;
    if (value instanceof ArrayBuffer) return value.byteLength;
    if (value instanceof Blob) return value.size;
    if (value instanceof URLSearchParams) return new TextEncoder().encode(value.toString()).length;
    if (value instanceof FormData) {
      let total = 0;
      for (const [, v] of (value as any).entries()) {
        if (typeof v === 'string') total += new TextEncoder().encode(v).length;
        else if (v instanceof Blob) total += v.size;
      }
      return total;
    }
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return 0;
  }
};

// 序列化请求体
const serializeBody = (data: any) => {
  if (data == null) return null;
  if (typeof data === 'string') return data;
  if (data instanceof URLSearchParams) return data.toString();
  if (data instanceof FormData) {
    const obj: Record<string, any> = {};
    (data as any).forEach((v: any, k: string) => {
      obj[k] = v instanceof Blob ? `{Blob:${v.type},${v.size}bytes}` : String(v);
    });
    return obj;
  }
  if (data instanceof ArrayBuffer) return `{ArrayBuffer:${data.byteLength}bytes}`;
  if (data instanceof Blob) return `{Blob:${data.type},${data.size}bytes}`;
  // 对象或数组
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
};

// 自定义适配器：拦截 /mock/* 路径并返回模拟数据
instance.defaults.adapter = (async (config: AxiosRequestConfig) => {
  const url = config.url || '';
  if (url.startsWith('/mock')) {
    await delay(300);
    if (url.includes('/mock/users')) {
      const resp: AxiosResponse = {
        data: {
          users: [
            { id: 1, name: 'Alice' },
            { id: 2, name: 'Bob' },
            { id: 3, name: 'Charlie' }
          ]
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: config as any
      };
      return resp;
    }
    if (url.includes('/mock/error')) {
      const resp: AxiosResponse = {
        data: { message: 'mock error' },
        status: 500,
        statusText: 'Internal Server Error',
        headers: {},
        config: config as any
      };
      return resp;
    }
  }
  return defaultAdapter(config as any);
}) as AxiosAdapter;

let reqCounter = 0;

// 请求拦截：记录 http-request（含完整报文）
instance.interceptors.request.use((cfg) => {
  const id = ++reqCounter;
  (cfg as any).__reqId = id;
  (cfg as any).__startAt = performance.now();

  const method = (cfg.method || 'GET').toUpperCase();
  const url = cfg.url || '';
  const headers = toPlainObject(cfg.headers || {});
  const body = serializeBody(cfg.data);
  const size = byteSize(cfg.data);

  try {
    // @ts-ignore rrweb 的类型未声明 addCustomEvent
    record.addCustomEvent('http-request', {
      requestId: id,
      method,
      url,
      headers,
      body,
      bodySize: size,
      timestamp: Date.now()
    });
  } catch {}

  return cfg;
});

// 响应拦截：记录 http-response / http-error（含完整报文与性能指标）
instance.interceptors.response.use(
  (res) => {
    const id = (res.config as any).__reqId;
    const startAt = (res.config as any).__startAt ?? performance.now();
    const endAt = performance.now();
    const durationMs = Math.max(0, endAt - startAt);

    const url = res.config.url || '';
    const status = res.status;
    const headers = toPlainObject(res.headers || {});
    const data = res.data;
    const isText = typeof data === 'string';
    const body = isText ? data : (() => { try { return JSON.stringify(data); } catch { return String(data); } })();
    const bodySize = byteSize(data);

    // 性能指标（可能拿不到，取资源条目第一个）
    let perf: any = null;
    try {
      const absoluteUrl = new URL(url, window.location.origin).href;
      const entries = performance.getEntriesByName(absoluteUrl, 'resource');
      if (entries && entries.length) {
        const e: PerformanceResourceTiming = entries[entries.length - 1] as any;
        perf = {
          transferSize: e.transferSize,
          encodedBodySize: e.encodedBodySize,
          decodedBodySize: e.decodedBodySize,
          startTime: e.startTime,
          responseEnd: e.responseEnd
        };
      }
    } catch {}

    try {
      // @ts-ignore
      record.addCustomEvent('http-response', {
        requestId: id,
        url,
        status,
        headers,
        body,
        bodySize,
        durationMs,
        perf,
        timestamp: Date.now()
      });
    } catch {}

    return res;
  },
  (error) => {
    const cfg = error.config || {};
    const id = (cfg as any).__reqId;
    const startAt = (cfg as any).__startAt ?? performance.now();
    const endAt = performance.now();
    const durationMs = Math.max(0, endAt - startAt);

    const url = cfg.url || '';
    const status = error.response?.status;
    const headers = toPlainObject(error.response?.headers || {});
    const data = error.response?.data;
    const body = data == null ? null : (() => { try { return typeof data === 'string' ? data : JSON.stringify(data); } catch { return String(data); } })();
    const bodySize = byteSize(data);

    try {
      // @ts-ignore
      record.addCustomEvent('http-error', {
        requestId: id,
        url,
        status,
        headers,
        body,
        bodySize,
        message: error.message,
        durationMs,
        timestamp: Date.now()
      });
    } catch {}

    return Promise.reject(error);
  }
);

export const http = instance;
export const fetchMockUsers = () => http.get('/mock/users');
export const fetchMockError = () => http.get('/mock/error');