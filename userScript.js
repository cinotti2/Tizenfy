(function() {
  if (window.top !== window) return;
  var lines = [], errors = [], box = null;
  function render() {
    if (!document.body) return;
    if (!box || !box.parentNode) {
      box = document.createElement("div");
      box.style.cssText = "position:fixed;top:12px;right:12px;width:46%;max-height:92%;overflow:hidden;z-index:2147483647;background:rgba(0,0,0,0.9);color:#fff;font:15px/1.35 monospace;padding:12px;border:3px solid #f5a623;white-space:pre-wrap;word-break:break-all;pointer-events:none;";
      document.body.appendChild(box);
    }
    box.textContent = "TIZENFY 1.0.7 VERIFICA\n" + lines.join("\n") + "\n\nERRORI (" + errors.length + "):\n" + errors.join("\n");
  }
  function add(l) {
    lines.push(l);
    render();
  }
  function addErr(e) {
    if (errors.length < 8) errors.push(e);
    render();
  }
  function short(u) {
    u = String(u || "");
    return u.split("?")[0].split("/").slice(-1)[0].slice(0, 40);
  }
  var cspSeen = {};
  document.addEventListener("securitypolicyviolation", function(e) {
    var k = e.violatedDirective + " " + short(e.blockedURI);
    if (cspSeen[k]) return;
    cspSeen[k] = 1;
    add("CSP BLOCCA: " + k);
  });
  window.addEventListener("error", function(ev) {
    var t = ev.target;
    if (t && t !== window && (t.src || t.href)) {
      addErr("NON CARICATO: " + short(t.src || t.href));
      return;
    }
    addErr((ev.message || "errore") + " @ " + short(ev.filename) + ":" + (ev.lineno || 0));
  }, true);
  try {
    eval("1+1");
    add("eval: SI");
  } catch (e) {
    add("eval: NO (" + e.name + ")");
  }
  try {
    new Function("return 1")();
    add("new Function: SI");
  } catch (e) {
    add("new Function: NO (" + e.name + ")");
  }
  try {
    new Function("var a={};return a?.b;");
    add("sintassi ?. : SI");
  } catch (e) {
    add("sintassi ?. : NO (" + e.name + ")");
  }
  if (window.WebAssembly) {
    WebAssembly.compile(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0])).then(function() {
      add("WebAssembly: SI");
    }).catch(function(e) {
      add("WebAssembly: NO (" + e.name + ")");
    });
  } else add("WebAssembly: assente");
  function scriptTests() {
    try {
      var s = document.createElement("script");
      s.textContent = "window.__tzInline = 1;";
      (document.head || document.documentElement).appendChild(s);
      add("script inline: " + (window.__tzInline === 1 ? "SI" : "NO"));
    } catch (e) {
      add("script inline: NO (" + e.name + ")");
    }
    try {
      var url = URL.createObjectURL(new Blob(["window.__tzBlob = 1;"], { type: "text/javascript" }));
      var b = document.createElement("script");
      b.src = url;
      b.onload = function() {
        add("script blob: " + (window.__tzBlob === 1 ? "SI" : "NO"));
      };
      b.onerror = function() {
        add("script blob: NO");
      };
      (document.head || document.documentElement).appendChild(b);
    } catch (e) {
      add("script blob: NO (" + e.name + ")");
    }
    var srcs = [];
    var all = document.getElementsByTagName("script");
    for (var i = 0; i < all.length; i++) if (all[i].src && /spotify/.test(all[i].src)) srcs.push(all[i].src);
    add("script Spotify nella pagina: " + srcs.length);
    srcs.slice(0, 3).forEach(function(u) {
      add("  " + short(u));
    });
    if (srcs.length) {
      var big = srcs[srcs.length - 1];
      for (var j = 0; j < srcs.length; j++) if (/web-player/.test(srcs[j])) big = srcs[j];
      fetch(big, { mode: "cors", credentials: "omit" }).then(function(r) {
        return r.text().then(function(t) {
          return { r, t };
        });
      }).then(function(o) {
        add("lettura script (CORS): SI, " + Math.round(o.t.length / 1024) + " KB");
        try {
          new Function(o.t);
          add("script letto su M63: OK");
        } catch (e) {
          add("script letto su M63: " + e.name + ": " + String(e.message).slice(0, 60));
        }
      }).catch(function(e) {
        add("lettura script (CORS): NO (" + (e && e.message) + ")");
      });
    }
    fetch("http://127.0.0.1:8765/").then(function(r) {
      return r.text();
    }).then(function(t) {
      add("servizio TV 8765: SI (" + t.slice(0, 20) + ")");
    }).catch(function(e) {
      add("servizio TV 8765: NO (" + (e && e.message) + ")");
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scriptTests);
  else scriptTests();
  setInterval(render, 2e3);
})();
(function() {
  "use strict";
  const CONFIG = {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    wsPort: 8765,
    adSelectors: [
      '[data-testid="context-item-info-ad-subtitle"]',
      ".Root__ads-container",
      '[data-testid="advertisement"]',
      '[aria-label="Advertisement"]',
      '.now-playing > a[href*="ad"]'
    ],
    // Known Spotify ad-delivery URL patterns — requests matching these are blocked
    // returning an empty 200 so the player doesn't throw a network error.
    adUrlPatterns: [
      /\/ads\//i,
      /\/ad-logic\//i,
      /\/adeventtracker\//i,
      /spclient\.wg\.spotify\.com\/ad-logic/i,
      /audio-ak\.spotify\.com\/audio\/.*_ad/i,
      /pagead/i,
      /doubleclick\.net/i,
      /googlesyndication/i
    ],
    // Milliseconds to wait after muting before attempting skip
    // (tiny delay avoids Spotify detecting an instant 0-second ad play)
    adSkipDelay: 300,
    // Minimum gap between auto-skips (prevents rapid-fire skipping on detection bounce)
    adSkipCooldown: 4e3,
    adCSS: `
      .Root__ads-container,
      [data-testid="context-item-info-ad-subtitle"],
      [data-testid="advertisement"],
      [aria-label="Advertisement"],
      [aria-label="Upgrade to Premium"],
      .WiPggcPDzbwGxoxwLWFf,
      .premium-upsell-container {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        height: 0 !important;
        overflow: hidden !important;
      }
    `,
    audioPollInterval: 500,
    adCheckInterval: 300,
    wsReconnectDelay: 3e3,
    statusInterval: 5e3,
    debug: false
  };
  const log = (...args) => {
    if (CONFIG.debug) console.log("[TizenSpotify]", ...args);
  };
  const state = {
    audioElements: /* @__PURE__ */ new Set(),
    isMuted: false,
    ws: null,
    wsConnected: false,
    lastSkipAt: 0
  };
  const COMMANDS = {
    playpause: () => clickSelector('[data-testid="control-button-playpause"]'),
    next: () => clickSelector('[data-testid="control-button-skip-forward"]'),
    prev: () => clickSelector('[data-testid="control-button-skip-back"]'),
    shuffle: () => clickSelector('[data-testid="control-button-shuffle"]'),
    repeat: () => clickSelector('[data-testid="control-button-repeat"]'),
    like: () => clickSelector('[data-testid="add-button"]'),
    queue: () => clickSelector('[data-testid="control-button-queue"]'),
    volumeup: () => adjustVolume(0.1),
    volumedown: () => adjustVolume(-0.1),
    search: () => clickSelector('[data-testid="search-icon"]') || clickSelector('a[href="/search"]'),
    home: () => clickSelector('a[href="/"]')
  };
  function clickSelector(selector) {
    try {
      const el = document.querySelector(selector);
      if (el) {
        el.click();
        log("Clicked:", selector);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }
  function adjustVolume(delta) {
    state.audioElements.forEach((el) => {
      el.volume = Math.min(1, Math.max(0, (el.volume || 1) + delta));
    });
  }
  function handleCommand(action) {
    log("Command:", action);
    if (COMMANDS[action]) {
      COMMANDS[action]();
      sendStatus();
    }
  }
  function connectWS() {
    try {
      const ws = new WebSocket(`ws://localhost:${CONFIG.wsPort}`);
      state.ws = ws;
      ws.onopen = () => {
        state.wsConnected = true;
        log("WS connected");
        ws.send(JSON.stringify({ type: "register", role: "script" }));
      };
      ws.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch (e) {
          return;
        }
        if (msg.type === "command") handleCommand(msg.action);
      };
      ws.onclose = () => {
        state.wsConnected = false;
        setTimeout(connectWS, CONFIG.wsReconnectDelay);
      };
      ws.onerror = () => {
      };
    } catch (e) {
      setTimeout(connectWS, CONFIG.wsReconnectDelay);
    }
  }
  function sendStatus() {
    var _a, _b, _c, _d;
    if (!state.ws || !state.wsConnected) return;
    try {
      const track = ((_b = (_a = document.querySelector('[data-testid="context-item-info-title"]')) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim()) || "";
      const artist = ((_d = (_c = document.querySelector('[data-testid="context-item-info-subtitles"]')) == null ? void 0 : _c.textContent) == null ? void 0 : _d.trim()) || "";
      const isPlaying = !!document.querySelector('[data-testid="control-button-playpause"][aria-label*="Pause"]');
      const isAd = isAdPlaying();
      state.ws.send(JSON.stringify({ type: "status", track, artist, isPlaying, isAd }));
    } catch (e) {
    }
  }
  function isAdUrl(url) {
    if (!url) return false;
    const str = typeof url === "string" ? url : url.toString();
    return CONFIG.adUrlPatterns.some((re) => re.test(str));
  }
  function interceptNetwork() {
    const origFetch = window.fetch;
    window.fetch = function(input, init2) {
      if (isAdUrl(input instanceof Request ? input.url : input)) {
        log("Blocked ad fetch:", input);
        return Promise.resolve(new Response("", { status: 200, headers: { "Content-Type": "text/plain" } }));
      }
      return origFetch.apply(this, arguments);
    };
    const OrigXHR = window.XMLHttpRequest;
    function PatchedXHR() {
      const xhr = new OrigXHR();
      const origOpen = xhr.open.bind(xhr);
      let blocked = false;
      xhr.open = function(method, url, ...rest) {
        if (isAdUrl(url)) {
          log("Blocked ad XHR:", url);
          blocked = true;
          origOpen(method, url, ...rest);
          return;
        }
        origOpen(method, url, ...rest);
      };
      const origSend = xhr.send.bind(xhr);
      xhr.send = function(...args) {
        if (blocked) {
          xhr.abort();
          return;
        }
        origSend(...args);
      };
      return xhr;
    }
    PatchedXHR.prototype = OrigXHR.prototype;
    window.XMLHttpRequest = PatchedXHR;
  }
  function setUserAgent() {
    try {
      if (typeof tizen !== "undefined" && tizen.websetting) {
        tizen.websetting.setUserAgentString(CONFIG.userAgent, () => {
        }, () => {
        });
      }
    } catch (e) {
    }
    try {
      Object.defineProperty(navigator, "userAgent", { get: () => CONFIG.userAgent, configurable: true });
    } catch (e) {
    }
  }
  function injectCSS() {
    const style = document.createElement("style");
    style.textContent = CONFIG.adCSS;
    (document.head || document.documentElement).appendChild(style);
  }
  function hookCreateElement() {
    const orig = document.createElement.bind(document);
    document.createElement = function(tag, ...args) {
      const el = orig(tag, ...args);
      if (typeof tag === "string" && tag.toLowerCase() === "audio") state.audioElements.add(el);
      return el;
    };
  }
  function startAudioPolling() {
    setInterval(() => {
      document.querySelectorAll("audio").forEach((el) => {
        if (!state.audioElements.has(el)) {
          state.audioElements.add(el);
          if (state.isMuted) el.muted = true;
        }
      });
    }, CONFIG.audioPollInterval);
  }
  function watchForAudioElements() {
    new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        m.addedNodes.forEach((node) => {
          if (node.nodeName === "AUDIO") {
            state.audioElements.add(node);
            if (state.isMuted) node.muted = true;
          }
          if (node.querySelectorAll) {
            node.querySelectorAll("audio").forEach((el) => {
              if (!state.audioElements.has(el)) {
                state.audioElements.add(el);
                if (state.isMuted) el.muted = true;
              }
            });
          }
        });
      });
    }).observe(document.body || document.documentElement, { childList: true, subtree: true });
  }
  function isAdPlaying() {
    for (const s of CONFIG.adSelectors) {
      try {
        if (document.querySelector(s)) return true;
      } catch (e) {
      }
    }
    return false;
  }
  function muteAll() {
    if (!state.isMuted) {
      state.isMuted = true;
      state.audioElements.forEach((el) => el.muted = true);
    }
  }
  function unmuteAll() {
    if (state.isMuted) {
      state.isMuted = false;
      state.audioElements.forEach((el) => el.muted = false);
    }
  }
  function trySkipAd() {
    const now = Date.now();
    if (now - state.lastSkipAt < CONFIG.adSkipCooldown) return;
    state.lastSkipAt = now;
    muteAll();
    setTimeout(() => {
      log("Auto-skipping ad");
      clickSelector('[data-testid="control-button-skip-forward"]');
    }, CONFIG.adSkipDelay);
  }
  function startAdWatcher() {
    let last = false;
    setInterval(() => {
      const now = isAdPlaying();
      if (now && !last) {
        last = true;
        trySkipAd();
      } else if (!now && last) {
        unmuteAll();
        last = false;
      }
    }, CONFIG.adCheckInterval);
  }
  function setupSamsungRemote() {
    try {
      if (typeof tizen !== "undefined" && tizen.tvinputdevice) {
        [
          "MediaPlayPause",
          "MediaPlay",
          "MediaPause",
          "MediaStop",
          "MediaFastForward",
          "MediaRewind",
          "MediaTrackNext",
          "MediaTrackPrevious",
          "ColorF0Red",
          "ColorF1Green",
          "ColorF2Yellow",
          "ColorF3Blue"
        ].forEach((k) => {
          try {
            tizen.tvinputdevice.registerKey(k);
          } catch (e) {
          }
        });
      }
    } catch (e) {
    }
    const keyMap = {
      415: "playpause",
      19: "playpause",
      10252: "playpause",
      417: "next",
      10233: "next",
      412: "prev",
      10232: "prev",
      403: "shuffle",
      404: "repeat",
      405: "like",
      406: "queue"
    };
    window.addEventListener("keydown", (e) => {
      if (keyMap[e.keyCode]) handleCommand(keyMap[e.keyCode]);
    });
  }
  function init() {
    interceptNetwork();
    setUserAgent();
    hookCreateElement();
    const ready = () => {
      injectCSS();
      startAudioPolling();
      watchForAudioElements();
      startAdWatcher();
      setupSamsungRemote();
      connectWS();
      setInterval(sendStatus, CONFIG.statusInterval);
      log("TizenSpotify ready");
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready);
    else ready();
  }
  init();
})();
