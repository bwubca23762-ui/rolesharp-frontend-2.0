import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";

const allowed = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const denied = (kind, host) => {
  const error = new Error(`network_deny:${kind}:${host || "unknown"}`);
  error.code = "ENETUNREACH";
  return error;
};
const hostFromRequest = (value, options) => {
  if (value instanceof URL) return value.hostname;
  if (typeof value === "string") {
    try { return new URL(value).hostname; } catch { /* request options below */ }
  }
  const candidate = typeof value === "object" && value ? value : options;
  return candidate?.hostname ?? candidate?.host?.split(":")[0] ?? "localhost";
};

const originalFetch = globalThis.fetch;
if (originalFetch) {
  globalThis.fetch = (input, init) => {
    const host = new URL(typeof input === "string" || input instanceof URL ? input : input.url).hostname;
    if (!allowed.has(host)) return Promise.reject(denied("fetch", host));
    return originalFetch(input, init);
  };
}

for (const transport of [http, https]) {
  const request = transport.request;
  const get = transport.get;
  transport.request = function guardedRequest(value, options) {
    const host = hostFromRequest(value, options);
    if (!allowed.has(host)) throw denied("http", host);
    return request.apply(this, arguments);
  };
  transport.get = function guardedGet(value, options) {
    const host = hostFromRequest(value, options);
    if (!allowed.has(host)) throw denied("http", host);
    return get.apply(this, arguments);
  };
}

for (const method of ["connect", "createConnection"]) {
  const original = net[method];
  net[method] = function guardedSocket(...args) {
    const first = args[0];
    if (typeof first === "string" && !/^\\\\\.\\pipe\\/u.test(first)) throw denied("net", first);
    const host = typeof first === "object" && first ? first.host ?? "localhost" : typeof args[1] === "string" ? args[1] : "localhost";
    if (!allowed.has(host)) throw denied("net", host);
    return original.apply(this, args);
  };
}

const originalLookup = dns.lookup;
dns.lookup = function guardedLookup(hostname, options, callback) {
  if (!allowed.has(String(hostname))) {
    const cb = typeof options === "function" ? options : callback;
    queueMicrotask(() => cb?.(denied("dns", String(hostname))));
    return;
  }
  return originalLookup.apply(this, arguments);
};

for (const method of ["resolve", "resolve4", "resolve6"]) {
  const original = dns[method];
  dns[method] = function guardedResolve(hostname, ...args) {
    if (!allowed.has(String(hostname))) {
      const cb = args.at(-1);
      queueMicrotask(() => typeof cb === "function" && cb(denied("dns", String(hostname))));
      return;
    }
    return original.call(this, hostname, ...args);
  };
}
