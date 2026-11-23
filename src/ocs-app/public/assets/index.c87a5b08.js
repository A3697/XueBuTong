var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
var _a, _b;
import { N as Notification, B as Button, M as Modal, a as Message, I as IconSync, S as Space, T as Tooltip, l as lang$1, C as Card, A as ArcoVue, b as ArcoVueIcon, c as Icon$1 } from "./@arco-design.3c56df6b.js";
import { X as h, j as resolveComponent, k as openBlock, l as createBlock, m as withCtx, a8 as KeepAlive, O as resolveDynamicComponent, a as reactive, e as defineComponent, c as computed, r as ref, o as onMounted, C as nextTick, A as onBeforeUnmount, p as createElementBlock, x as renderSlot, y as createTextVNode, z as toDisplayString, w as watch, v as createVNode, a9 as useSlots, t as toRefs, n as createBaseVNode, $ as unref, q as normalizeStyle, u as normalizeClass, F as Fragment, P as renderList, s as createCommentVNode, H as withModifiers, M as withDirectives, N as vShow, G as createSlots, f as onUnmounted, a2 as shallowRef, _ as createApp } from "./@vue.10d2ded6.js";
import { u as useRouter, c as createRouter, a as createWebHashHistory } from "./vue-router.1b6385d9.js";
import { a as defaultsDeep_1, g as get_1, c as cloneDeep_1, d as debounce_1 } from "./lodash.4ddd9dd3.js";
import { d as dayjs } from "./dayjs.a79bd2ae.js";
import { M as MarkdownIt } from "./markdown-it.a39105cb.js";
import { m as markdownItEmoji } from "./markdown-it-emoji.14324b8a.js";
import { m as markdownItContainer } from "./markdown-it-container.9b7103eb.js";
import { a as axios } from "./axios.1e37c3a4.js";
import { e as events } from "./events.7cc16d47.js";
import { C as ColorPicker } from "./colorpicker-v3.2c723672.js";
import { x as xterm } from "./xterm.9fe37c82.js";
import { x as xtermAddonFit } from "./xterm-addon-fit.1029e58f.js";
/* empty css                         */import "./resize-observer-polyfill.375322e1.js";
import "./compute-scroll-into-view.079a5c71.js";
import "./b-tween.3dc4e04f.js";
import "./number-precision.a111f450.js";
import "./scroll-into-view-if-needed.10a505ff.js";
import "./b-validate.edd52b51.js";
import "./@babel.dac5e1c0.js";
import "./global.dfc622c4.js";
import "./entities.9efde8b5.js";
import "./uc.micro.428571ea.js";
import "./mdurl.b48c0e08.js";
import "./linkify-it.91515adc.js";
import "./punycode.768648d9.js";
(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) {
    return;
  }
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) {
    processPreload(link);
  }
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") {
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.tagName === "LINK" && node.rel === "modulepreload")
          processPreload(node);
      }
    }
  }).observe(document, { childList: true, subtree: true });
  function getFetchOpts(script) {
    const fetchOpts = {};
    if (script.integrity)
      fetchOpts.integrity = script.integrity;
    if (script.referrerpolicy)
      fetchOpts.referrerPolicy = script.referrerpolicy;
    if (script.crossorigin === "use-credentials")
      fetchOpts.credentials = "include";
    else if (script.crossorigin === "anonymous")
      fetchOpts.credentials = "omit";
    else
      fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep)
      return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
})();
const inBrowser = typeof global === "undefined";
if (inBrowser === false) {
  window.electron = require("electron");
  window.child_process = require("child_process");
}
const electron = window.electron || {
  ipcRenderer: {
    sendSync: () => {
    },
    send: () => {
    },
    on: () => {
    },
    once: () => {
    }
  }
};
const child_process = window.child_process || {};
class StringUtils {
  constructor(_text) {
    __publicField(this, "_text");
    this._text = _text;
  }
  static nowrap(str) {
    return (str == null ? void 0 : str.replace(/\n/g, "")) || "";
  }
  nowrap() {
    this._text = StringUtils.nowrap(this._text);
    return this;
  }
  static noSpecialChar(str) {
    return (str == null ? void 0 : str.replace(/[^\w\s]/gi, "")) || "";
  }
  noSpecialChar() {
    this._text = StringUtils.noSpecialChar(this._text);
    return this;
  }
  static max(str, len) {
    return str.length > len ? str.substring(0, len) + "..." : str;
  }
  max(len) {
    this._text = StringUtils.max(this._text, len);
    return this;
  }
  static hide(str, start, end, replacer = "*") {
    return str.substring(0, start) + str.substring(start, end).replace(/./g, replacer) + str.substring(end);
  }
  hide(start, end, replacer = "*") {
    this._text = StringUtils.hide(this._text, start, end, replacer);
    return this;
  }
  static of(text) {
    return new StringUtils(text);
  }
  toString() {
    return this._text;
  }
}
const { clipboard } = electron;
let fusionNativeNoticeSequence = 0;
function fusionTimedNoticeContent(content) {
  const key = ++fusionNativeNoticeSequence;
  return () => h(Fragment, null, [
    typeof content === "function" ? content() : content,
    h("span", { key, class: "fusion-native-notice-countdown", "aria-hidden": "true" })
  ]);
}
function installFusionResultMessages() {
  if (Message.__fusionResultCountdown) return;
  Object.defineProperty(Message, "__fusionResultCountdown", { value: true });
  for (const type of ["info", "success", "warning", "error"]) {
    const original = Message[type];
    Message[type] = function(config, appContext) {
      const value = typeof config === "string" ? { content: config } : config || {};
      // Indefinite notices and loading/progress updates keep their own lifecycle.
      if (value.duration === 0 || value.type === "loading") return original.call(this, config, appContext);
      return original.call(this, { ...value, duration: 5000, resetOnHover: false, content: fusionTimedNoticeContent(value.content) }, appContext);
    };
  }
}
installFusionResultMessages();
function notify(title, msg, key, options) {
  const timed = (options == null ? void 0 : options.duration) !== 0 && (options == null ? void 0 : options.type) !== "loading";
  const content = () => {
    var _a3;
    return h("div", {
      title: (msg == null ? void 0 : msg.stack) || (msg == null ? void 0 : msg.message) || msg || "",
      innerHTML: StringUtils.max(String(msg), (_a3 = options == null ? void 0 : options.max_length) != null ? _a3 : 999)
    });
  };
  return Notification[(options == null ? void 0 : options.type) || "info"]({
    id: key,
    title,
    closable: true,
    style: { width: "400px" },
    content: timed ? fusionTimedNoticeContent(content) : content,
    duration: timed ? 5000 : 0,
    footer: () => (options == null ? void 0 : options.btn) || h("div", [
      (options == null ? void 0 : options.copy) ? cerateCopyButton(title, msg, key, options) : "",
      (options == null ? void 0 : options.close) ? createCloseButton(key) : ""
    ])
  });
}
function createCloseButton(key) {
  return h(
    Button,
    {
      type: "primary",
      size: "small",
      onClick: () => {
        Notification.remove(key);
      }
    },
    "\u5173\u95ED"
  );
}
function cerateCopyButton(title, msg, key, options) {
  return h(
    Button,
    {
      type: "primary",
      size: "small",
      onClick: () => {
        clipboard.writeText(title + "\n" + String(msg));
        notify(title, msg, key, {
          ...options,
          ...{
            btn: h(
              Button,
              {
                type: "primary",
                size: "small",
                disabled: true
              },
              "\u590D\u5236\u6210\u529F\u221A"
            )
          }
        });
      }
    },
    "\u590D\u5236\u4FE1\u606F"
  );
}
const { ipcRenderer: ipcRenderer$2 } = electron;
function registerRemote(eventName) {
  function sendSync(channel, ...args) {
    const res = ipcRenderer$2.sendSync(channel, ...args);
    if (res == null ? void 0 : res.error) {
      console.log(res);
      if (errorFilter$1(res.error)) {
        return;
      }
      notify("remote \u6A21\u5757\u9519\u8BEF", res.error, "remote", { copy: true, type: "error" });
    }
    return res;
  }
  function send(channel, args) {
    return new Promise((resolve, reject) => {
      ipcRenderer$2.once(args[0], (e, ...respondArgs) => {
        if (respondArgs[0].error) {
          console.log({ respondArgs, channel, args });
          if (!errorFilter$1(respondArgs[0].error)) {
            notify("remote \u6A21\u5757\u9519\u8BEF", respondArgs[0].error, "remote", { copy: true, type: "error" });
          }
          reject(String(respondArgs[0].error));
        } else {
          resolve(respondArgs[0].data);
        }
      });
      ipcRenderer$2.send(channel, JSON.parse(JSON.stringify(args)));
    });
  }
  return {
    get(property) {
      return sendSync(eventName + "-get", [property]);
    },
    set(property, value) {
      return sendSync(eventName + "-set", [property, value]);
    },
    call(property, ...args) {
      const respondChannel = getRespondChannelId(property.toString());
      return send(eventName + "-call", [respondChannel, property, ...args]);
    },
    callSync(property, ...args) {
      const response = sendSync(eventName + "-call-sync", [property, ...args]);
      if (response == null ? void 0 : response.error) {
        notify("remote \u6A21\u5757\u9519\u8BEF", response.error, "remote", { copy: true, type: "error" });
        throw new Error(response.error);
      }
      return response.data;
    }
  };
}
function getRespondChannelId(property) {
  return `${property}-${(Math.random() * 1e3).toFixed(0)}-${Date.now()}`;
}
const remote = {
  "electron-store": registerRemote("electron-store"),
  fs: registerRemote("fs"),
  path: registerRemote("path"),
  os: registerRemote("os"),
  crypto: registerRemote("crypto"),
  OCSApi: registerRemote("OCSApi"),
  win: registerRemote("win"),
  webContents: registerRemote("webContents"),
  app: registerRemote("app"),
  dialog: registerRemote("dialog"),
  methods: registerRemote("methods"),
  logger: registerRemote("logger")
};
function errorFilter$1(str) {
  if (String(str).includes("CrashpadMetrics")) {
    return true;
  }
}
const App_vue_vue_type_style_index_0_scoped_e4670342_lang = "";
const _export_sfc = (sfc, props) => {
  const target = sfc.__vccOpts || sfc;
  for (const [key, val] of props) {
    target[key] = val;
  }
  return target;
};
const _sfc_main$g = {};
function _sfc_render(_ctx, _cache) {
  const _component_router_view = resolveComponent("router-view");
  return openBlock(), createBlock(_component_router_view, null, {
    default: withCtx(({ Component }) => [
      (openBlock(), createBlock(KeepAlive, null, [
        (openBlock(), createBlock(resolveDynamicComponent(Component)))
      ], 1024))
    ]),
    _: 1
  });
}
const App = /* @__PURE__ */ _export_sfc(_sfc_main$g, [["render", _sfc_render], ["__scopeId", "data-v-e4670342"]]);
const scriptRel = "modulepreload";
const assetsURL = function(dep, importerUrl) {
  return new URL(dep, importerUrl).href;
};
const seen = {};
const __vitePreload = function preload(baseModule, deps, importerUrl) {
  if (!deps || deps.length === 0) {
    return baseModule();
  }
  const links = document.getElementsByTagName("link");
  return Promise.all(deps.map((dep) => {
    dep = assetsURL(dep, importerUrl);
    if (dep in seen)
      return;
    seen[dep] = true;
    const isCss = dep.endsWith(".css");
    const cssSelector = isCss ? '[rel="stylesheet"]' : "";
    const isBaseRelative = !!importerUrl;
    if (isBaseRelative) {
      for (let i = links.length - 1; i >= 0; i--) {
        const link2 = links[i];
        if (link2.href === dep && (!isCss || link2.rel === "stylesheet")) {
          return;
        }
      }
    } else if (document.querySelector(`link[href="${dep}"]${cssSelector}`)) {
      return;
    }
    const link = document.createElement("link");
    link.rel = isCss ? "stylesheet" : scriptRel;
    if (!isCss) {
      link.as = "script";
      link.crossOrigin = "";
    }
    link.href = dep;
    document.head.appendChild(link);
    if (isCss) {
      return new Promise((res, rej) => {
        link.addEventListener("load", res);
        link.addEventListener("error", () => rej(new Error(`Unable to preload CSS for ${dep}`)));
      });
    }
  })).then(() => baseModule());
};
const _imports_0 = "" + new URL("../../../../../assets/fusion.png", import.meta.url).href;
const fusionNativeStoreDefaults = {
    render: {
      scripts: [],
      notifies: [],
      browser: {
        currentFolderUid: "",
        currentBrowserUid: "",
        root: {
          name: "\u6839\u76EE\u5F55",
          parent: void 0,
          createTime: Date.now(),
          type: "root",
          uid: "root-folder",
          children: {},
          renaming: false
        },
        tags: {},
        search: {
          value: "",
          tags: [],
          results: void 0
        }
      },
      dashboard: {
        details: {
          tags: false,
          notes: false
        },
        num: 4,
        video: {
          aspectRatio: 0
        }
      },
      setting: {
        browserType: "diy",
        showSideBarText: true,
        launchOptions: {
          custom: false,
          executablePath: ""
        },
        theme: {
          dark: false
        },
        ocs: {
          currentProjectName: "",
          store: {},
          openSync: false
        },
        browser: {
          cachesSizeWarningPoint: 10,
          enableDialog: false,
          forceUpdateScript: false
        }
      },
      langs: {},
      state: {
        first: true,
        setup: true,
        mini: false,
        responsive: "small",
        height: document.documentElement.clientHeight,
        read_record: {}
      }
    }
  };
const _store = defaultsDeep_1(inBrowser ? JSON.parse(localStorage.getItem("ocs-app-store") || "{}") : remote["electron-store"].get("store"), cloneDeep_1(fusionNativeStoreDefaults));
if (typeof _store.render === "string") {
  try {
    const data = JSON.parse(
      remote.methods.callSync(
        "decryptString",
        _store.render
      )
    );
    Reflect.set(_store, "render", defaultsDeep_1(data, cloneDeep_1(fusionNativeStoreDefaults.render)));
  } catch (e) {
    console.error("\u6570\u636E\u89E3\u5BC6\u5931\u8D25\uFF1A" + e);
  }
}
const store = reactive(_store);
window.store = store;
reactive([]);
reactive(/* @__PURE__ */ new Map());
function lang(key, def, params) {
  let text = store.render.langs[key];
  if (!text) {
    text = def || "";
  }
  if (params) {
    Object.keys(params).forEach((k) => {
      text = text.replace(new RegExp(`{{${k}}}`, "g"), params[k]);
    });
  }
  return text;
}
const markdownText = "";
const container = "";
function markdownContainer(md) {
  createContainer({
    md,
    name: "code",
    renders: {
      open() {
        return "<details><summary>\u70B9\u51FB\u67E5\u770B\u4EE3\u7801</summary>\n";
      },
      close() {
        return "</details>\n";
      }
    }
  });
  createCommonContainer(md, "info");
  createCommonContainer(md, "warning");
  createCommonContainer(md, "success");
  createCommonContainer(md, "error");
  createContainer({
    md,
    name: "video",
    renders: {
      open(tokens, idx) {
        const [input, src] = tokens[idx].info.trim().match(/^video (.*)$/) || [];
        console.log(tokens[idx].info, [input, src]);
        return `<video class="mt-3 mb-3 video-js w-100" controls>
        <source src="${src == null ? void 0 : src.trim()}" type="video/mp4">
        </video>`;
      },
      close() {
        return ``;
      }
    }
  });
}
function createCommonContainer(md, name) {
  createContainer({
    md,
    name,
    renders: {
      open(tokens, idx) {
        const m = tokens[idx].info.trim().match(RegExp(`^${name}\\s+(.*)$`));
        return `
                                <div class='container-${name}'>
                                    <p class='container-title'>${(m == null ? void 0 : m[1]) || ""}</p>
                                    <div class='container-body'>
                            `;
      },
      close() {
        return "</div></div>";
      }
    }
  });
}
function createContainer({
  md,
  name,
  renders,
  maker = ":"
}) {
  md.use(markdownItContainer, name, {
    maker,
    validate: (params) => RegExp(name).test(params.trim()),
    render: (tokens, idx) => {
      if (tokens[idx].nesting === 1) {
        return renders.open(tokens, idx);
      } else {
        return renders.close(tokens, idx);
      }
    }
  });
}
const markdownIt = MarkdownIt({
  html: true,
  xhtmlOut: false,
  breaks: true,
  langPrefix: "language-",
  linkify: true,
  typographer: true,
  quotes: "\u201C\u201D\u2018\u2019"
});
markdownIt.use(markdownItEmoji).use(markdownContainer);
const _hoisted_1$a = ["innerHTML"];
const _sfc_main$f = /* @__PURE__ */ defineComponent({
  __name: "MarkdownText",
  props: {
    content: {}
  },
  setup(__props) {
    const props = __props;
    const md = computed(() => markdownIt.render(props.content));
    const players = ref([]);
    onMounted(() => {
      nextTick(() => {
        const videos = Array.from(document.querySelectorAll(".video-js"));
        for (const video of videos) {
          const options = {
            bigPlayButton: true,
            controls: true,
            playbackRates: [1, 1.5, 2],
            fluid: true
          };
          const player = videojs(video, options);
          player.addClass("w-100");
          player.volume(0.3);
          players.value.push(player);
        }
      });
    });
    onBeforeUnmount(() => {
      for (const player of players.value) {
        player.dispose();
      }
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", {
        class: "markdown-text",
        innerHTML: md.value
      }, null, 8, _hoisted_1$a);
    };
  }
});
class OCSApi {
  static async getInfos() {
    const { data } = await axios.get("https://cdn.ocsjs.com/api/ocs-app-infos.json?t=" + Date.now(), { timeout: 10000 });
    return data;
  }
}
const { ipcRenderer: ipcRenderer$1 } = electron;
function sleep(timeout) {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}
function date(time) {
  return dayjs(time).format("YYYY-MM-DD");
}
function datetime(time) {
  return dayjs(time).format("YYYY-MM-DD HH:mm");
}
async function fetchRemoteNotify(readAll) {
  return; // Lab: optional online announcements/language updates are excluded.
  try {
    const infos = await getRemoteInfos();
    let remoteNotify = infos.notify;
    const storeNotify = store.render.notifies;
    if (!readAll) {
      remoteNotify = remoteNotify.filter(
        (item) => storeNotify.findIndex((localeItem) => (item == null ? void 0 : item.id) === (localeItem == null ? void 0 : localeItem.id)) === -1
      );
    }
    if (remoteNotify.length) {
      Modal.confirm({
        title: () => "\u{1F389}\u6700\u65B0\u516C\u544A\u{1F389}",
        okText: readAll ? "\u786E\u5B9A" : "\u6715\u5DF2\u9605\u8BFB",
        cancelText: readAll ? "\u53D6\u6D88" : "\u4E0B\u6B21\u4E00\u5B9A",
        hideCancel: false,
        simple: true,
        width: 600,
        content: () => h(
          "div",
          {
            style: {
              maxHeight: "320px",
              overflow: "auto"
            }
          },
          remoteNotify.map(
            (item) => h("div", [
              h(
                "div",
                {
                  style: {
                    marginBottom: "6px",
                    fontWeight: "bold"
                  }
                },
                (item == null ? void 0 : item.id) || "\u65E0\u6807\u9898"
              ),
              h(
                "ul",
                item.content.map((text) => h("li", text))
              )
            ])
          )
        ),
        onOk() {
          if (!readAll) {
            store.render.notifies = [...store.render.notifies].concat(remoteNotify);
          }
        },
        onCancel() {
        }
      });
    }
  } catch (e) {
    Message.error("\u6700\u65B0\u901A\u77E5\u83B7\u53D6\u5931\u8D25\uFF1A" + e);
  }
}
async function fetchRemoteLangs() {
  return; // Lab: optional online announcements/language updates are excluded.
  try {
    const infos = await axios.get("https://cdn.ocsjs.com/api/ocs-app-langs.json?t=" + Date.now(), {
      headers: {
        "content-type": "application/json"
      }
    });
    try {
      JSON.parse(JSON.stringify(infos.data));
      store.render.langs = infos.data;
    } catch {
    }
  } catch (e) {
    Message.error("\u83B7\u53D6\u8BED\u8A00\u6587\u4EF6\u5931\u8D25\uFF1A" + e);
  }
}
let temp_infos, infos_request, infos_attempted = false;
function validateResourceInfos(infos) {
  const validId = (value) => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(value);
  const validUrl = (value) => {
    try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; }
    catch (_) { return false; }
  };
  const groups = infos?.resourceGroups;
  if (!Array.isArray(groups) || !groups.length || groups.length > 32 || groups.some(group => !group || !validId(group.name) || !Array.isArray(group.files) || group.files.length > 1000 || group.files.some(file => !file || !validId(file.id) || typeof file.name !== "string" || !file.name || !validUrl(file.url))) || !groups.some(group => group.name === "extensions") || !groups.some(group => group.name === "apps")) {
    throw Error("应用目录格式无效");
  }
  for (const group of groups) {
    if (group.name === "apps") for (const file of group.files) {
      if (file.id === "ocr") file.description = "用于学不通浏览器自动登录流程中的验证码识别。";
    }
  }
  return infos;
}
async function getRemoteInfos(refresh = false, localOnly = false) {
  if (!temp_infos) {
    const appPath = await remote.app.call("getAppPath");
    const file = await remote.path.call("join", appPath, "public", "application-catalog.json");
    const bundled = validateResourceInfos(JSON.parse(await remote.fs.call("readFileSync", file, { encoding: "utf8" })));
    temp_infos = { ...bundled, _fusionCatalog: { source: "bundled" } };
  }
  if (localOnly || (!refresh && infos_attempted)) return structuredClone(temp_infos);
  if (!infos_request) {
    infos_attempted = true;
    infos_request = (async () => {
      try {
        const infos = validateResourceInfos(await OCSApi.getInfos());
        temp_infos = { ...infos, _fusionCatalog: { source: "online" } };
      } catch (_) {
        const source = temp_infos._fusionCatalog.source === "bundled" ? "bundled" : "cached";
        temp_infos = { ...temp_infos, _fusionCatalog: { source } };
      }
      return temp_infos;
    })().finally(() => { infos_request = void 0; });
  }
  return structuredClone(await infos_request);
}
async function download({
  name,
  dest,
  url
}) {
  const listener = (e, channel, rate, chunkLength, totalLength) => {
    installListener(name, channel, rate, chunkLength, totalLength);
  };
  ipcRenderer$1.on("download", listener);
  try {
    return await remote.methods.call("download", "download-file-" + name, url, dest);
  } catch (err) {
    Message.error("\u4E0B\u8F7D\u9519\u8BEF " + err.message);
  }
  ipcRenderer$1.removeListener("download", listener);
}
function installListener(name, channel, rate, chunkLength, totalLength) {
  if (channel === "download-file-" + name) {
    if (rate === 100) {
      return notify(
        "\u6587\u4EF6\u4E0B\u8F7D",
        `${name} \u4E0B\u8F7D\u5B8C\u6210: ${(totalLength / 1024 / 1024).toFixed(2)}MB`,
        "download-file-" + name,
        {
          type: "success",
          duration: 5000
        }
      );
    } else {
      return notify(
        "\u6587\u4EF6\u4E0B\u8F7D",
        `${name} \u4E0B\u8F7D\u4E2D: ${(chunkLength / 1024 / 1024).toFixed(2)}MB/${(totalLength / 1024 / 1024).toFixed(2)}MB`,
        "download-file-" + name,
        {
          type: "info",
          duration: 0
        }
      );
    }
  }
}
async function openFusionAbout(event) {
  event?.preventDefault?.();event?.stopImmediatePropagation?.();
  try{
    if(typeof window.xingchanLab?.openAbout==='function')return await window.xingchanLab.openAbout();
    if(typeof window.xingchanBridge?.openAbout==='function')return await window.xingchanBridge.openAbout();
    Modal.info({title:'关于学不通',content:'学不通 2.5.12。本地关于窗口尚未就绪，请稍后重试。',okText:'关闭'});
  }catch(_){Modal.error({title:'关于学不通',content:'本地关于窗口暂时无法打开，请稍后重试。',okText:'关闭'});}
}
async function about() {
  store.render.state.first = false;
  const guide = await remote.methods.call("get", "https://cdn.ocsjs.com/articles/app/guide.md");
  Modal.info({
    title: "\u8F6F\u4EF6\u4F7F\u7528\u6559\u7A0B",
    closable: true,
    simple: false,
    maskClosable: false,
    footer: false,
    width: "auto",
    bodyStyle: {
      maxWidth: "800px"
    },
    content: () => h(_sfc_main$f, {
      content: guide,
      style: {
        maxHeight: "70vh"
      }
    })
  });
}
const fusionSystemTheme = window.matchMedia("(prefers-color-scheme: dark)");
fusionSystemTheme.addEventListener("change", () => { if (store.render.setting.theme.mode === "system") void changeTheme(); });
async function changeTheme() {
  const theme = store.render.setting.theme;
  const mode = ["system", "light", "dark"].includes(theme.mode) ? theme.mode : theme.dark ? "dark" : "light";
  theme.mode = mode;
  let dark = mode === "system" ? fusionSystemTheme.matches : mode === "dark";
  try { dark = (await electron.ipcRenderer.invoke("fusion-theme:mode", mode)).dark; } catch {}
  theme.dark = dark;
  document.body.classList.toggle("fusion-dark", dark);
  if (dark) document.body.setAttribute("arco-theme", "dark");
  else document.body.removeAttribute("arco-theme");
  const platform = await remote.methods.call("getPlatform");
  document.body.classList.add("platform-" + platform);
  if (platform !== "darwin") remote.win.call("setTitleBarOverlay", { color: dark ? "#2C2C2C" : "#fff", symbolColor: dark ? "white" : "black" });
}
function setAutoLaunch() {
  remote.methods.call("autoLaunch",store.window.autoLaunch).catch(console.error);
}
function setAlwaysOnTop() {
  remote.win.call("setAlwaysOnTop", store.window.alwaysOnTop);
}
function size(num) {
  var _a2;
  return (_a2 = [
    ["GB", Math.pow(1024, 3)],
    ["MB", Math.pow(1024, 2)],
    ["KB", Math.pow(1024, 1)],
    ["B", 1]
  ].map((i) => [i[0], Math.floor(num / i[1])]).find((i) => parseFloat(i[1].toString()) > 0)) == null ? void 0 : _a2.reduce((pre, cur) => cur + pre);
}
const _sfc_main$e = /* @__PURE__ */ defineComponent({
  __name: "TitleLink",
  props: {
    url: {},
    title: {}
  },
  setup(__props) {
    const { shell: shell2 } = electron;
    function open(url) {
      shell2.openExternal(url);
    }
    return (_ctx, _cache) => {
      const _component_a_doption = resolveComponent("a-doption");
      return openBlock(), createBlock(_component_a_doption, {
        onClick: _cache[0] || (_cache[0] = ($event) => open(__props.url))
      }, {
        default: withCtx(() => [
          renderSlot(_ctx.$slots, "title", {}, () => [
            createTextVNode(toDisplayString(__props.title), 1)
          ])
        ]),
        _: 3
      });
    };
  }
});
class Process extends events.exports {
  constructor(browser, launchOptions) {
    super();
    __publicField(this, "uid");
    __publicField(this, "shell");
    __publicField(this, "worker");
    __publicField(this, "status", "closed");
    __publicField(this, "browser");
    __publicField(this, "launchOptions");
    __publicField(this, "logs", []);
    __publicField(this, "video");
    __publicField(this, "stream");
    this.browser = browser;
    this.uid = browser.uid;
    this.launchOptions = launchOptions;
    this.startupController = new AbortController();
  }
  static from(uid) {
    return processes.find((p) => p.uid === uid);
  }
  static remove(uid, expected) {
    const index = processes.findIndex((p) => p.uid === uid);
    if (index !== -1 && (!expected || processes[index] === expected)) {
      const removed=processes.splice(index, 1)[0];
      removed.status="closed";removed.startupController?.abort();
      if(removed?.fusionLease)window.xingchanBridge?.releaseBrowser({uid,id:removed.fusionLease.id}).catch(()=>{});
    }
  }
  assertStarting() {
    if(this.startupController.signal.aborted)throw Object.assign(Error("浏览器启动已取消"),{code:"BROWSER_START_CANCELLED"});
  }
  async waitForStartup(work,timeoutMs=180000) {
    const signal=this.startupController.signal;this.assertStarting();let timer,onAbort;
    const cancelled=new Promise((_,reject)=>{
      onAbort=()=>reject(Object.assign(Error("浏览器启动已取消"),{code:"BROWSER_START_CANCELLED"}));
      signal.addEventListener("abort",onAbort,{once:true});
      timer=setTimeout(()=>reject(Object.assign(Error("浏览器启动超时，已停止本次启动。请检查账号日志后重试。"),{code:"BROWSER_START_TIMEOUT"})),timeoutMs);
    });
    try{return await Promise.race([cancelled,Promise.resolve().then(work)]);}
    finally{clearTimeout(timer);signal.removeEventListener("abort",onAbort);}
  }
  async init(onConsole) {
    var _a2, _b2;
    const workerPath=await remote.path.call("join", await remote.app.call("getAppPath"), "./script.js");
    this.assertStarting();
    this.shell = child_process.fork(
      workerPath,
      {
        stdio: ["ipc"],
        env: process.env
      }
    );
    this.worker = createRemoteScriptWorker(this.shell);
    this.shell.once("exit",()=>{this.workerExited=true;this.emit("startup-exit");Process.remove(this.uid, this);});
    this.shell.on("error",error=>{this.logs.push("浏览器进程异常："+String(error.message));this.emit("startup-error",error);});
    (_a2 = this.shell.stdout) == null ? void 0 : _a2.on("data", (data) => {
      this.logs.push(data.toString());
      onConsole == null ? void 0 : onConsole(data.toString());
    });
    (_b2 = this.shell.stderr) == null ? void 0 : _b2.on("data", (data) => {
      onConsole == null ? void 0 : onConsole(data.toString());
      remote.logger.call("error", String(data));
      this.logs.push(`${this.browser.name} \u9519\u8BEF`, data);
      notify(`${this.browser.name} \u9519\u8BEF`, data, this.browser.uid, {
        duration: 60 * 1e3,
        copy: true,
        type: "error"
      });
    });
    const listeners = {
      'ocs-plugin-conflict':info=>{void window.FusionOcsPlugins?.action('reportOcsConflict',info).then(()=>window.FusionWorkspace?.notify('OCS 增强接口不兼容，已保留兼容版本并暂停自动更新。请停止后重新启动该账号浏览器。',{role:'alert'})).catch(()=>{});},
      "browser-identity":info=>{void window.xingchanBridge?.recordBrowserName({uid:this.uid,...info}).then(()=>window.dispatchEvent(new Event('fusion-login-verified'))).catch(()=>{});},
      launched: async () => {
        if(!this.startupController.signal.aborted&&this.status==="launching")this.status = "launched";
      },
      "browser-closed": () => {
        console.log("browser-closed", this.uid);
        Process.remove(this.uid, this);
      }
    };
    this.shell.on("message", ({ event, args }) => {
      this.emit(event, ...args);
      if (listeners[event]) {
        listeners[event](...args);
      }
    });
    this.worker("init", {
      store,
      cachePath: this.browser.cachePath,
      uid: this.uid,
      playwrightScripts: this.launchOptions.withoutAutomation ? [] : this.browser.playwrightScripts,
      browserInfo: {
        name: this.browser.name,
        notes: this.browser.notes,
        tags: this.browser.tags
      },
      config: {
        enable_dialog: store.render.setting.browser.enableDialog,
        force_update_script: store.render.setting.browser.forceUpdateScript,
        playbackSpeed:window.FusionWorkspace?.state.prefs.speeds[this.uid]
      },
      langs: store.render.langs
    });
  }
  async launch() {
    this.assertStarting();
    if(!this.launchOptions.executablePath)throw Error("浏览器路径为空，请在软件设置中修改");
    if(!await remote.fs.call("existsSync",this.launchOptions.executablePath))throw Error("浏览器路径不存在，请在软件设置中修改");
    this.assertStarting();const accountOcs=await window.FusionOcsPlugins?.prepare(this.uid);this.assertStarting();
    if(accountOcs&&accountOcs.uid!==this.uid)throw Error("OCS 账号运行配置不匹配，请重新启动");
    const enabledUserScripts=(accountOcs?.scripts||store.render.scripts).filter(s=>s.enable);
    for(const script of enabledUserScripts){
      if(!script.url.startsWith("http")&&!await remote.fs.call("existsSync",script.info?.code_url||script.url))
        notify("本地脚本不存在","请在脚本列表检查缺失脚本的路径。", "process_launch_error_"+script.url,{duration:60000,type:"warning"});
      this.assertStarting();
    }
    if(!this.shell?.connected||this.workerExited)throw Error("浏览器启动进程已退出，请重试");
    this.status="launching";
    await new Promise((resolve,reject)=>{
      const done=()=>{cleanup();resolve();};
      const failed=error=>{cleanup();reject(error instanceof Error?error:Error("浏览器未完成启动，请查看账号日志后重试"));};
      const aborted=()=>failed(Object.assign(Error("浏览器启动已取消"),{code:"BROWSER_START_CANCELLED"}));
      const cleanup=()=>{this.removeListener("launched",done);this.removeListener("startup-error",failed);this.removeListener("startup-exit",failed);this.removeListener("startup-failed",failed);this.removeListener("browser-closed",failed);this.startupController.signal.removeEventListener("abort",aborted);};
      this.once("launched",done);this.once("startup-error",failed);this.once("startup-exit",failed);this.once("startup-failed",failed);this.once("browser-closed",failed);this.startupController.signal.addEventListener("abort",aborted,{once:true});
      try{this.worker("launch",{userDataDir:this.browser.cachePath,userscripts:(this.launchOptions.withoutAutomation?[]:enabledUserScripts).map(s=>(s.isLocalScript?"file://":"")+(s.info?.code_url||s.url)),...this.launchOptions,ocsAccountRuntime:accountOcs?{uid:this.uid,enhanced:accountOcs.enhanced,scriptSelection:accountOcs.scriptSelection,runtime:this.launchOptions.withoutAutomation?null:accountOcs.runtime}:null});}catch(error){failed(error);}
    });
  }
  async close() {
    if(this.closingOperation)return this.closingOperation;
    this.status="closing";this.startupController.abort();
    if(!this.shell||this.workerExited){Process.remove(this.uid,this);return;}
    this.closingOperation=new Promise((resolve,reject)=>{
      let finished=false,timer;
      const done=error=>{if(finished)return;finished=true;clearTimeout(timer);this.removeListener("browser-closed",closed);this.shell.removeListener("exit",closed);Process.remove(this.uid,this);error?reject(error):resolve();};
      const closed=()=>done();this.once("browser-closed",closed);this.shell.once("exit",closed);
      // Only this account's worker and descendants are stopped if graceful cleanup hangs.
      timer=setTimeout(()=>{
        if(this.workerExited)return done();
        child_process.execFile("taskkill.exe",["/PID",String(this.shell.pid),"/T","/F"],{windowsHide:true,timeout:5000},error=>done(this.workerExited?null:error));
      },10000);
      try{if(this.shell.connected)this.worker("close");else this.shell.kill();}catch(error){this.logs.push("浏览器关闭请求未送达："+String(error.message));}
    });return this.closingOperation;
  }
  bringToFront() {
    if(this.status==="launched"&&this.shell?.connected)this.worker("bringToFront");
    else Message.warning("请先启动此账号的浏览器");
  }
  toString() {
    return "[Process]";
  }
}
const processes = reactive([]);
// A separate UI state map reuses native controls without creating native browser workers.
const fusionBrowserProcesses = reactive(new Map());
const fusionBrowserActions = reactive({current:null});
const fusionLoginProfileRevision = ref(0);
for(const type of ['fusion-login-profiles-ready','fusion-login-profiles-changed'])window.addEventListener(type,()=>{fusionLoginProfileRevision.value++;});
function setFusionBrowserActions(actions) { fusionBrowserActions.current = actions; }
function watchFusionProcesses(listener) { return watch(() => processes.map(p => [p.uid,p.status]), listener, {deep:true,flush:"post"}); }
function readFusionNativeCredentials(){return root().findAll(item=>item.type==="browser").map(item=>{const next=window.FusionAutomationConfigs?.normalizeScripts(item.playwrightScripts);if(next&&JSON.stringify(next)!==JSON.stringify(item.playwrightScripts))item.playwrightScripts=next;return {uid:item.uid,...(window.FusionLoginProfiles?.parse(item.playwrightScripts)||{kind:'none',platform:'none',starEligible:false,hasNativeSelection:false,username:'',password:'',unit:''})};});}
function writeFusionNativeCredentials(value){
  const browser=Browser.from(value.uid),profiles=window.FusionLoginProfiles;if(!browser||!profiles)return false;
  if(value.clear===true){
    const index=browser.playwrightScripts.indexOf(value.script);if(index<0||!profiles.definitions[value.script.name])return false;
    const cleared=JSON.parse(JSON.stringify(value.script));
    for(const [key,cfg]of Object.entries(cleared.configs||{})){if(key==='loginType')continue;if(typeof cfg==='string')cleared.configs[key]='';else if(cfg&&typeof cfg==='object')cfg.value='';}
    browser.playwrightScripts.splice(index,1,cleared);return true;
  }
  if(!value.migrate||profiles.parse(browser.playwrightScripts).hasNativeSelection||!['cx-phone','cx-unit'].includes(value.kind))return false;
  const spec=profiles.kinds[value.kind],raw=remote.methods.callSync('getRawScripts').find(script=>script.name===spec.name);if(!raw)return false;
  const login=JSON.parse(JSON.stringify(raw));if(login.configs.loginType)login.configs.loginType.value=value.kind.endsWith('-unit')?'unit':'phone';login.configs[spec.username].value=value.username||'';login.configs.password.value=value.password||'';if(spec.unit)login.configs[spec.unit].value=value.unit||'';browser.playwrightScripts=[...(browser.playwrightScripts||[]),login];return true;
}
function watchFusionCredentials(listener){return watch(readFusionNativeCredentials,listener,{deep:true,flush:"post"});}

function setFusionBrowserStatus(uid, status) {
  if (status && ["launching", "launched", "closing"].includes(status)) {
    if (fusionBrowserProcesses.get(uid)?.status !== status) fusionBrowserProcesses.set(uid, {status});
  } else fusionBrowserProcesses.delete(uid);
}
function createRemoteScriptWorker(shell2) {
  return (event, ...args) => {
    if (shell2.connected) {
      shell2.send({ event, args });
    }
  };
}
function resetSearch() {
  store.render.browser.search.value = "";
  store.render.browser.search.tags = [];
}
class Entity {
  constructor(opts) {
    __publicField(this, "uid");
    __publicField(this, "name");
    __publicField(this, "createTime");
    __publicField(this, "renaming");
    this.uid = opts.uid;
    this.name = opts.name;
    this.createTime = opts.createTime;
    this.renaming = opts.renaming;
  }
  static uuid() {
    return uuid().replace(/-/g, "");
  }
}
function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}
const nativeLaunches = new Map();
const nativeRemovals = new Map();
function confirmNativeRemoval(entity,accountCount=1,folder=false){
  const name=String(entity.name||entity.uid||'').slice(0,120);
  return new Promise(resolve=>Modal.warning({title:folder?'删除分组与账号':'删除账号',simple:true,hideCancel:false,maskClosable:false,okText:folder?'删除分组与账号':'删除账号',cancelText:'取消',content:folder?'是否删除分组“'+name+'”及其中的 '+accountCount+' 个账号？确认后将逐个关闭账号，删除账号设置和浏览器缓存；此操作无法撤销。':'是否删除账号“'+name+'”？确认后将关闭此账号，删除账号设置和浏览器缓存；此操作无法撤销。',onOk(){resolve(true);},onCancel(){resolve(false);},onClose(){resolve(false);}}));
}
class Browser extends Entity {
  constructor(opts) {
    super(opts);
    __publicField(this, "type");
    __publicField(this, "tags");
    __publicField(this, "notes");
    __publicField(this, "checked");
    __publicField(this, "cachePath");
    __publicField(this, "histories");
    __publicField(this, "parent");
    __publicField(this, "playwrightScripts");
    this.type = "browser";
    this.tags = opts.tags;
    this.notes = opts.notes;
    this.checked = opts.checked;
    this.histories = opts.histories;
    this.parent = opts.parent;
    this.playwrightScripts = window.FusionAutomationConfigs?.normalizeScripts(opts.playwrightScripts) || opts.playwrightScripts;
    // Older batch imports stored the display name as a bare string among login fields.
    for (const script of this.playwrightScripts || []) {
      if (typeof script.configs?.browserName === 'string') delete script.configs.browserName;
    }
    this.cachePath = opts.cachePath;
  }
  static from(uid) {
    return root().find("browser", uid);
  }
  async launch(options = {}) {
    const existing=Process.from(this.uid);
    if(existing&&existing.status!=="closed")return existing.bringToFront();
    if(nativeLaunches.has(this.uid))return nativeLaunches.get(this.uid);
    const pending=(async()=>{
      const bridge=window.xingchanBridge;
      if(!bridge?.claimBrowser)throw Error("融合启动服务尚未就绪");
      await window.FusionWorkspace?.flushCredentials?.();
      await window.FusionAccountForm?.flush();
      const login=window.FusionLoginProfiles?.parse(this.playwrightScripts);
      const lease=await bridge.claimBrowser({uid:this.uid,login,username:login?.username});
      let reactiveProcess;
      try{
        const process2=new Process(this,{executablePath:store.render.setting.launchOptions.executablePath,headless:false,withoutAutomation:options.withoutAutomation===true});
        process2.fusionLease=lease;process2.status="launching";processes.push(process2);reactiveProcess=Process.from(this.uid);
        if(reactiveProcess)await reactiveProcess.waitForStartup(async()=>{await reactiveProcess.init(console.log);await reactiveProcess.launch();});
        this.histories.unshift({action:"运行浏览器",time:Date.now()});
      }catch(error){
        if(reactiveProcess){reactiveProcess.logs.push(String(error.message||"启动未完成"));await reactiveProcess.close();}
        else await bridge.releaseBrowser({uid:this.uid,id:lease.id}).catch(()=>{});
        if(error.code!=="BROWSER_START_CANCELLED")throw error;
      }
    })().finally(()=>nativeLaunches.delete(this.uid));
    nativeLaunches.set(this.uid,pending);return pending;
  }
  async onlyLaunch() { return this.launch({withoutAutomation:true}); }
  async relaunch() {
    const process2 = Process.from(this.uid);
    await (process2 == null ? void 0 : process2.close());
    await this.launch();
  }
  async close() {
    const process2 = Process.from(this.uid);
    await (process2 == null ? void 0 : process2.close());
    this.histories.unshift({ action: "\u5173\u95ED", time: Date.now() });
  }
  bringToFront() {
    const process2 = Process.from(this.uid);
    process2 == null ? void 0 : process2.bringToFront();
  }
  location() {
    router.push("/");
    resetSearch();
    store.render.browser.currentFolderUid = this.parent;
    nextTick(() => {
      store.render.browser.currentBrowserUid = this.uid;
      this.select();
    });
  }
  select() {
    store.render.browser.currentBrowserUid = this.uid;
  }
  async remove(options={}) {
    const key='browser:'+this.uid;if(nativeRemovals.has(key))return nativeRemovals.get(key);
    const pending=(async()=>{
      if(options?.confirmed!==true&&!await confirmNativeRemoval(this))return false;
      await window.xingchanBridge?.stop({uid:this.uid});
      const process2 = Process.from(this.uid);
      if (process2)await process2.close();
      const bridge=window.xingchanBridge;
      if(!bridge?.prepareBrowserCacheRemoval||!bridge?.removeAccountSettings)throw Error('账号清理服务尚未就绪，请稍后重试。');
      const parent=Folder.from(this.parent),cache=await bridge.prepareBrowserCacheRemoval({uid:this.uid,cachePath:this.cachePath});
      try{await bridge.removeAccountSettings({uid:this.uid});}
      catch(error){if(cache?.id){try{await bridge.restoreBrowserCacheRemoval({uid:this.uid,id:cache.id});}catch(restoreError){remote.logger.call('warn','账号缓存恢复','隔离缓存尚未恢复',{uid:this.uid,cacheRecord:cache.id});throw restoreError;}}throw error;}
      let warning=cache?.warning||'';
      if(cache?.id){try{const result=await bridge.finishBrowserCacheRemoval({uid:this.uid,id:cache.id});warning=result?.warning||warning;}catch{warning='账号已删除，隔离缓存尚未清理，已保留以便检查。';}}
      Reflect.deleteProperty((parent == null ? void 0 : parent.children) || {}, this.uid);
      if(warning){remote.logger.call('warn','账号缓存清理',warning,{uid:this.uid,cacheRecord:cache?.id||''});window.FusionWorkspace?.notify(warning);}
      return true;
    })().finally(()=>nativeRemovals.delete(key));nativeRemovals.set(key,pending);return pending;
  }
  rename(name) {
    if (this.name !== name) {
      this.histories.unshift({ action: "\u6539\u540D", content: `${this.name} => ${name}`, time: Date.now() });
    }
    this.name = name;
    this.renaming = false;
  }
  async cleanCache() {
    try {
      await remote.fs.call("rmSync", this.cachePath, { recursive: true, force: true });
    } catch (err) {
      console.log(err);
    }
  }
}
function formatExtensionArguments(extensionPaths) {
  const paths = extensionPaths.filter((f) => f.includes(".DS_Store") === false).map((p) => p.replace(/\\/g, "/")).join(",");
  return [`--load-extension="${paths}"`];
}
class Folder extends Entity {
  constructor(opts) {
    super(opts);
    __publicField(this, "type");
    __publicField(this, "parent");
    __publicField(this, "children", {});
    this.type = opts.type;
    this.parent = opts.parent;
    this.children = opts.children;
    for (const key in this.children) {
      if (Object.prototype.hasOwnProperty.call(this.children, key)) {
        const child = this.children[key];
        if (child.type === "browser") {
          this.children[key] = new Browser(child);
        } else {
          this.children[key] = new Folder(child);
        }
      }
    }
  }
  listChildren() {
    return Object.values(this.children);
  }
  static from(uid) {
    return uid === root().uid ? root() : root().find("folder", uid);
  }
  find(type, uid) {
    let target = this.children[uid];
    if (target && target.type === type) {
      return target;
    } else {
      for (const key in this.children) {
        if (Object.prototype.hasOwnProperty.call(this.children, key)) {
          const child = this.children[key];
          if (child.type === "folder") {
            const res = child.find(type, uid);
            target = target || res;
          }
        }
      }
    }
    return target;
  }
  findAll(handler) {
    const list = [];
    for (const key in this.children) {
      if (Object.prototype.hasOwnProperty.call(this.children, key)) {
        const child = this.children[key];
        if (handler(child)) {
          list.push(child);
        }
        if (child.type === "folder") {
          list.push(...child.findAll(handler));
        }
      }
    }
    return list;
  }
  flatParents() {
    let parents;
    if (this.parent) {
      const parent = Folder.from(this.parent);
      if (parent) {
        parents = parent.flatParents();
      }
    }
    return [...parents || [], this];
  }
  location() {
    router.push("/");
    resetSearch();
    store.render.browser.currentFolderUid = this.uid;
  }
  select() {
    store.render.browser.currentFolderUid = this.uid;
  }
  async remove() {
    if(!this.parent)return false;const key='folder:'+this.uid;if(nativeRemovals.has(key))return nativeRemovals.get(key);
    const pending=(async()=>{const accounts=this.findAll(item=>item.type==='browser').map(item=>item.uid);if(accounts.length&&!await confirmNativeRemoval(this,accounts.length,true))return false;for(const uid of accounts){const removed=await Browser.from(uid)?.remove({confirmed:true});if(removed===false&&Browser.from(uid))throw Error('账号删除已取消，分组尚未删除');}const parent=Folder.from(this.parent);if(parent)Reflect.deleteProperty(parent.children,this.uid);return true;})().finally(()=>nativeRemovals.delete(key));nativeRemovals.set(key,pending);return pending;
  }
  rename(name) {
    this.name = name;
    this.renaming = false;
  }
}
let _root;
const root = () => {
  if (_root) {
    return _root;
  } else {
    return _root = reactive(new Folder(store.render.browser.root));
  }
};
watch(
  () => _root,
  () => {
    store.render.browser.root = JSON.parse(JSON.stringify(root));
  }
);
const currentFolder = computed(() => root().find("folder", store.render.browser.currentFolderUid) || root());
const currentEntities = computed(() => {const items=currentFolder.value.listChildren(),order=store.render.browser.accountOrders?.[currentFolder.value.uid];return window.FusionAccountOrder?window.FusionAccountOrder.ordered(items,order):items;});
const currentBrowser = computed(() => root().find("browser", store.render.browser.currentBrowserUid));
const fusionAccountNames = reactive(new Map());
function cacheFusionAccountName(uid, name) {
  if(uid && typeof name === 'string') fusionAccountNames.set(uid, name.trim());
}
window.addEventListener('fusion-account-settings', event => cacheFusionAccountName(event.detail?.uid, event.detail?.settings?.displayName));
window.addEventListener('fusion-account-status', event => cacheFusionAccountName(event.detail?.uid, event.detail?.displayName));
const currentSearchedEntities = computed(() => {
  if (store.render.browser.search.value === "" && store.render.browser.search.tags.length === 0) {
    return void 0;
  } else {
    return root().findAll(
      (e) => store.render.browser.search.value !== "" && (e.name.indexOf(store.render.browser.search.value) !== -1 || e.type === "browser" && (e.notes.indexOf(store.render.browser.search.value) !== -1 || (fusionAccountNames.get(e.uid) || "").includes(store.render.browser.search.value))) || store.render.browser.search.tags.length !== 0 && store.render.browser.search.tags.some((t) => e.type === "browser" && e.tags.some((et) => et.name === t))
    );
  }
});
const { shell } = electron;
function newFolder() {
  resetSearch();
  const id = Entity.uuid();
  const folder = new Folder({
    uid: id,
    type: "folder",
    name: "未命名分组",
    children: {},
    createTime: Date.now(),
    parent: currentFolder.value.uid,
    renaming: true
  });
  currentFolder.value.children[id] = folder;
}
export async function confirmFusionDuplicates(candidates, excludeUid) {
  const profiles = window.FusionLoginProfiles;
  if (!profiles) throw Error('登录配置尚未就绪，请稍后重试。');
  const seen = new Map();
  for (const account of root().findAll(e => e.type === 'browser' && e.uid !== excludeUid)) {
    const key = profiles.accountKey(profiles.parse(account.playwrightScripts));
    if (key) seen.set(key, account.name || '未命名账号');
  }
  const duplicates = [];
  for (const [index, account] of candidates.entries()) {
    const key = profiles.accountKey(profiles.parse(account.playwrightScripts));
    if (!key) continue;
    const name = account.name || `第 ${index + 1} 个账号`;
    if (seen.has(key)) duplicates.push(`${name} 与 ${seen.get(key)}`);
    else seen.set(key, name);
  }
  if (!duplicates.length) return true;
  return new Promise(resolve => Modal.confirm({
    title: '发现重复账号',
    content: h('div', {}, [h('p', {}, '以下配置的登录方式和登录账号相同（学校登录还会区分学校）：'),
      h('ul', {}, duplicates.slice(0, 5).map(name => h('li', {}, name))),
      duplicates.length > 5 ? h('p', {}, `另有 ${duplicates.length - 5} 项重复。`) : null,
      h('p', {}, '是否仍然保留这些独立配置？原有账号不会被覆盖。')]),
    okText: '仍然保留', cancelText: '返回修改', maskClosable: false,
    onOk: () => { resolve(true); }, onCancel: () => { resolve(false); }
  }));
}
const fusionLoginEditors = new Set();
export async function flushFusionLoginFields() {
  for (const flush of fusionLoginEditors) if (!await flush()) throw Error('已取消重复账号配置');
}
function newBrowser(opts) {
  var _a2, _b2, _c;
  if (!((_c = (_b2 = (_a2 = store == null ? void 0 : store.render) == null ? void 0 : _a2.setting) == null ? void 0 : _b2.launchOptions) == null ? void 0 : _c.executablePath)) {
    Message.error("请先在软件设置中设置浏览器路径，然后添加账号。");
    return;
  }
  resetSearch();
  const id = Entity.uuid();
  const userDataDirsFolder = store.paths.userDataDirsFolder;
  const path_sep = remote.path.get("sep");
  currentFolder.value.children[id] = new Browser({
    type: "browser",
    uid: id,
    name: (opts == null ? void 0 : opts.name) || "未命名账号",
    checked: false,
    createTime: Date.now(),
    notes: "",
    renaming: opts?.configureLogin !== false,
    parent: currentFolder.value.uid,
    histories: [{ action: "\u521B\u5EFA", time: Date.now() }],
    cachePath: inBrowser ? "" : userDataDirsFolder.endsWith(path_sep) ? userDataDirsFolder + id : userDataDirsFolder + path_sep + id,
    tags: [],
    playwrightScripts: (opts == null ? void 0 : opts.playwrightScripts) ? JSON.parse(JSON.stringify(opts == null ? void 0 : opts.playwrightScripts)) : []
  });
  if (opts?.configureLogin !== false) {
    store.render.browser.fusionSelectLoginUid=id;
    store.render.browser.currentBrowserUid=id;
  }
  return currentFolder.value.children[id];
}
async function checkBrowserCaches() {
  const modal = Modal.info({
    simple: false,
    title: "\u6B63\u5728\u8BA1\u7B97\u6D4F\u89C8\u5668\u7F13\u5B58...",
    footer: false,
    maskClosable: false,
    content: () => {
      return h("div", [h(IconSync, { spin: true }), "\u6B63\u5728\u8BA1\u7B97\u6D4F\u89C8\u5668\u7F13\u5B58..."]);
    }
  });
  const totalSize = await remote.methods.call("statisticFolderSize", store.paths.userDataDirsFolder);
  console.log("\u5F53\u524D\u6D4F\u89C8\u5668\u603B\u7F13\u5B58\u5927\u5C0F", size(totalSize));
  modal.close();
  showClearBrowserCachesModal(totalSize);
}
function showClearBrowserCachesModal(totalSize) {
  Modal.confirm({
    simple: false,
    title: "\u6E05\u9664\u6D4F\u89C8\u5668\u7F13\u5B58",
    content: () => {
      return h("div", [
        h("p", { class: "text-secondary" }, [
          "\u63D0\u793A\uFF1A\u6D4F\u89C8\u5668\u7F13\u5B58\u4E3B\u8981\u5B58\u50A8\u4E00\u4E9BCookie\uFF0C\u7F51\u9875\u6570\u636E\uFF0C\u5982\u679C\u5360\u7528\u975E\u5E38\u5927\u53EF\u4EE5\u6E05\u9664\uFF0C\u4E0D\u4F1A\u5F71\u54CD\u6D4F\u89C8\u5668\u6B63\u5E38\u4F7F\u7528\u3002"
        ]),
        h("p", [
          "\u5F53\u524D\u6D4F\u89C8\u5668\u7F13\u5B58\u8DEF\u5F84\uFF1A",
          store.paths.userDataDirsFolder,
          " ",
          h(Button, { type: "text", size: "small", onClick: () => shell.openPath(store.paths.userDataDirsFolder) }, [
            "\u8FDB\u5165\u7F13\u5B58\u6587\u4EF6\u5939"
          ])
        ]),
        h("p", ["\u5F53\u524D\u6D4F\u89C8\u5668\u7F13\u5B58\u603B\u5927\u5C0F\uFF1A", size(totalSize)])
      ]);
    },
    okText: "\u6E05\u9664\u7F13\u5B58",
    onOk() {
      const browsers = Folder.from(store.render.browser.root.uid).findAll((e) => e.type === "browser");
      clearAllBrowserCaches(
        store.paths.userDataDirsFolder,
        browsers.map((b) => b.uid)
      );
    }
  });
}
function clearAllBrowserCaches(userDataDirsFolder, uids) {
  return new Promise((resolve, reject) => {
    remote.fs.call("readdirSync", userDataDirsFolder, {}).then(async (_dirs) => {
      try {
        const paths = [];
        const dirs = _dirs;
        for (const dir of dirs) {
          if (dir && dir.trim() && uids.includes(dir.trim())) {
            paths.push(await remote.path.call("join", userDataDirsFolder, String(dir)));
          }
        }
        await Promise.all(
          paths.map((path) => {
            return remote.fs.call("rmSync", path, {
              recursive: true,
              force: true
            });
          })
        );
      } catch (err) {
        console.error(err);
        if (String(err).includes("CrashpadMetrics.pma") === false) {
          Message.error(String(err));
          reject(err);
        }
      }
      Message.success("\u6E05\u9664\u6D4F\u89C8\u5668\u7F13\u5B58\u5B8C\u6210");
      resolve();
    });
  });
}
async function forceClearBrowserCache(title, userDataDirsFolder) {
  const modal = Modal.warning({
    title: "\u63D0\u793A",
    content: () => h("div", [h(IconSync, { spin: true }), title]),
    maskClosable: false,
    closable: false,
    footer: false
  });
  const browsers = Folder.from(store.render.browser.root.uid).findAll((e) => e.type === "browser");
  try {
    await clearAllBrowserCaches(
      userDataDirsFolder,
      browsers.map((b) => b.uid)
    );
  } catch (err) {
    console.error(err);
    Message.error(String(err));
  }
  await sleep(500);
  modal.close();
}
async function closeAllBrowser(confirmed=false) {
  if (processes.length) {
    if(confirmed){for(const process2 of [...processes])await process2.close();return true;}
    return new Promise((resolve, reject) => {
      Modal.warning({
        content: "\u8FD8\u6709\u6D4F\u89C8\u5668\u6B63\u5728\u8FD0\u884C\uFF0C\u60A8\u786E\u5B9A\u5173\u95ED\u8F6F\u4EF6\u5417\uFF1F",
        title: "\u8B66\u544A",
        maskClosable: true,
        closable: true,
        alignCenter: true,
        hideCancel: false,
        onOk: async () => {
          const m = Modal.info({
            content: "\u6B63\u5728\u5173\u95ED\u6240\u6709\u6D4F\u89C8\u5668...",
            closable: false,
            maskClosable: false,
            footer: false
          });
          const timeout = setTimeout(close, 5e3);
          try {
            for (const process2 of processes) {
              await process2.close();
              await sleep(100);
            }
          } catch (err) {
            Message.error(String(err));
          }
          clearTimeout(timeout);
          m.close();
          resolve(true);
        },
        onCancel() {
          resolve(false);
        }
      });
    });
  }
}
const _sfc_main$d = /* @__PURE__ */ defineComponent({
  __name: "CommonEditActionDropdown",
  setup(__props) {
    function mousedown(e) {
      e.preventDefault();
    }
    function exec(id) {
      if (typeof window === "undefined") {
        return remote.webContents.call(id);
      } else {
        return document.execCommand(id);
      }
    }
    return (_ctx, _cache) => {
      const _component_a_doption = resolveComponent("a-doption");
      const _component_a_col = resolveComponent("a-col");
      const _component_a_row = resolveComponent("a-row");
      const _component_a_dropdown = resolveComponent("a-dropdown");
      return openBlock(), createBlock(_component_a_dropdown, {
        class: "tittle-dropdown",
        trigger: "hover",
        "popup-max-height": false
      }, {
        content: withCtx(() => [
          createVNode(_component_a_doption, { style: { "width": "200px" } }),
          createVNode(_component_a_doption, {
            class: "w-100",
            onMousedown: mousedown,
            onClick: _cache[0] || (_cache[0] = ($event) => exec("copy"))
          }, {
            default: withCtx(() => [
              createVNode(_component_a_row, null, {
                default: withCtx(() => [
                  createVNode(_component_a_col, { flex: "20px" }, {
                    default: withCtx(() => [..._cache[5] || (_cache[5] = [
                      createTextVNode(" \u590D\u5236 ", -1)
                    ])]),
                    _: 1
                  }),
                  createVNode(_component_a_col, {
                    flex: "auto",
                    class: "text-end"
                  }, {
                    default: withCtx(() => [..._cache[6] || (_cache[6] = [
                      createTextVNode(" Ctrl + C ", -1)
                    ])]),
                    _: 1
                  })
                ]),
                _: 1
              })
            ]),
            _: 1
          }),
          createVNode(_component_a_doption, {
            onMousedown: mousedown,
            onClick: _cache[1] || (_cache[1] = ($event) => exec("cut"))
          }, {
            default: withCtx(() => [
              createVNode(_component_a_row, null, {
                default: withCtx(() => [
                  createVNode(_component_a_col, { flex: "20px" }, {
                    default: withCtx(() => [..._cache[7] || (_cache[7] = [
                      createTextVNode(" \u526A\u5207 ", -1)
                    ])]),
                    _: 1
                  }),
                  createVNode(_component_a_col, {
                    flex: "auto",
                    class: "text-end"
                  }, {
                    default: withCtx(() => [..._cache[8] || (_cache[8] = [
                      createTextVNode(" Ctrl + X ", -1)
                    ])]),
                    _: 1
                  })
                ]),
                _: 1
              })
            ]),
            _: 1
          }),
          createVNode(_component_a_doption, {
            onMousedown: mousedown,
            onClick: _cache[2] || (_cache[2] = ($event) => exec("paste"))
          }, {
            default: withCtx(() => [
              createVNode(_component_a_row, null, {
                default: withCtx(() => [
                  createVNode(_component_a_col, { flex: "20px" }, {
                    default: withCtx(() => [..._cache[9] || (_cache[9] = [
                      createTextVNode(" \u7C98\u8D34 ", -1)
                    ])]),
                    _: 1
                  }),
                  createVNode(_component_a_col, {
                    flex: "auto",
                    class: "text-end"
                  }, {
                    default: withCtx(() => [..._cache[10] || (_cache[10] = [
                      createTextVNode(" Ctrl + V ", -1)
                    ])]),
                    _: 1
                  })
                ]),
                _: 1
              })
            ]),
            _: 1
          }),
          createVNode(_component_a_doption, {
            onMousedown: mousedown,
            onClick: _cache[3] || (_cache[3] = ($event) => exec("undo"))
          }, {
            default: withCtx(() => [
              createVNode(_component_a_row, null, {
                default: withCtx(() => [
                  createVNode(_component_a_col, { flex: "20px" }, {
                    default: withCtx(() => [..._cache[11] || (_cache[11] = [
                      createTextVNode(" \u4E0A\u4E00\u6B65\uFF08\u6062\u590D\uFF09 ", -1)
                    ])]),
                    _: 1
                  }),
                  createVNode(_component_a_col, {
                    flex: "auto",
                    class: "text-end"
                  }, {
                    default: withCtx(() => [..._cache[12] || (_cache[12] = [
                      createTextVNode(" Ctrl + Z ", -1)
                    ])]),
                    _: 1
                  })
                ]),
                _: 1
              })
            ]),
            _: 1
          }),
          createVNode(_component_a_doption, {
            onMousedown: mousedown,
            onClick: _cache[4] || (_cache[4] = ($event) => exec("redo"))
          }, {
            default: withCtx(() => [
              createVNode(_component_a_row, null, {
                default: withCtx(() => [
                  createVNode(_component_a_col, { flex: "20px" }, {
                    default: withCtx(() => [..._cache[13] || (_cache[13] = [
                      createTextVNode(" \u4E0B\u4E00\u6B65\uFF08\u8FD8\u539F\uFF09 ", -1)
                    ])]),
                    _: 1
                  }),
                  createVNode(_component_a_col, {
                    flex: "auto",
                    class: "text-end"
                  }, {
                    default: withCtx(() => [..._cache[14] || (_cache[14] = [
                      createTextVNode(" Ctrl + Y ", -1)
                    ])]),
                    _: 1
                  })
                ]),
                _: 1
              })
            ]),
            _: 1
          })
        ]),
        default: withCtx(() => [
          renderSlot(_ctx.$slots, "default", {}, void 0, true)
        ]),
        _: 3
      });
    };
  }
});
const CommonEditActionDropdown_vue_vue_type_style_index_0_scoped_845a80fb_lang = "";
const CommonEditActionDropdown = /* @__PURE__ */ _export_sfc(_sfc_main$d, [["__scopeId", "data-v-845a80fb"]]);
const _hoisted_1$9 = ["title"];
const _sfc_main$c = /* @__PURE__ */ defineComponent({
  __name: "Icon",
  props: {
    type: {},
    theme: { default: "outlined" },
    title: { default: "" },
    active: { type: Boolean },
    color: { default: void 0 },
    size: { default: void 0 }
  },
  setup(__props) {
    const span = h("span");
    const slots = useSlots();
    const props = __props;
    const { type } = toRefs(props);
    return (_ctx, _cache) => {
      return openBlock(), createBlock(resolveDynamicComponent(unref(slots).default ? unref(Space) : unref(span)), {
        class: "d-inline-flex",
        size: "mini"
      }, {
        default: withCtx(() => [
          createBaseVNode("span", {
            style: normalizeStyle({ color: __props.color, fontSize: __props.size ? __props.size + "px" : "inherit" }),
            class: normalizeClass("material-icons" + (__props.theme === "filled" ? "" : "-" + __props.theme)),
            title: __props.title
          }, toDisplayString(unref(type)), 15, _hoisted_1$9),
          createBaseVNode("span", null, [
            renderSlot(_ctx.$slots, "default", {}, void 0, true)
          ])
        ]),
        _: 3
      });
    };
  }
});
const Icon_vue_vue_type_style_index_0_scoped_43ebc42d_lang = "";
const Icon = /* @__PURE__ */ _export_sfc(_sfc_main$c, [["__scopeId", "data-v-43ebc42d"]]);
const _hoisted_1$8 = { class: "title ps-2" };
const _sfc_main$b = /* @__PURE__ */ defineComponent({
  __name: "Title",
  setup(__props) {
    const { shell: shell2 } = electron;
    function relaunch() {
      remote.app.call("relaunch");
      remote.app.call("quit");
    }
    async function openLog() {
      const path = await remote.path.call("join", await remote.app.call("getPath", "logs"), date(Date.now()));
      shell2.openPath(path);
    }
    function allNotify() {
      fetchRemoteNotify(true);
    }
    function importData(){return window.FusionWorkspace?.importData();}
    function exportData(){return window.FusionWorkspace?.exportData();}
    function openDevTools() {
      window.ocs = {
        currentBrowser,
        currentEntities,
        currentFolder,
        currentSearchedEntities,
        root,
        store
      };
      remote.webContents.call("openDevTools");
    }
    async function showVersionLogs() {return openFusionAbout();}
    return (_ctx, _cache) => {
      const _component_a_doption = resolveComponent("a-doption");
      const _component_a_dropdown = resolveComponent("a-dropdown");
      return openBlock(), createElementBlock("div", _hoisted_1$8, [
        createBaseVNode("span", {
          class: "logo",
          style: { "cursor": "pointer", "-webkit-app-region": "no-drag" },
          role:"button",tabindex:0,title:"关于学不通 2.5.12","aria-label":"关于学不通",
          onClick:openFusionAbout,onKeydown:event=>{if(event.key==='Enter'||event.key===' ')openFusionAbout(event);}
        }, [..._cache[3] || (_cache[3] = [
          createBaseVNode("img", {
            width: "18",
            class: "me-3",
            src: _imports_0,alt:"学不通"
          }, null, -1)
        ])]),
        createVNode(_component_a_dropdown, {
          class: "tittle-dropdown",
          trigger: "hover",
          "popup-max-height": false
        }, {
          content: withCtx(() => [
            createVNode(_component_a_doption, { style: { "width": "200px" } }),
            createVNode(_component_a_doption, {
              onClick: _cache[1] || (_cache[1] = ($event) => unref(store).render.state.setup = true)
            }, {
              default: withCtx(() => [
                createVNode(Icon, { type: "settings" }, {
                  default: withCtx(() => [..._cache[4] || (_cache[4] = [
                    createTextVNode("\u521D\u59CB\u5316\u8BBE\u7F6E", -1)
                  ])]),
                  _: 1
                })
              ]),
              _: 1
            }),
            createVNode(_component_a_doption, {
              class: "border-bottom",
              onClick: unref(checkBrowserCaches)
            }, {
              default: withCtx(() => [
                createVNode(Icon, { type: "delete" }, {
                  default: withCtx(() => [..._cache[5] || (_cache[5] = [
                    createTextVNode("\u6E05\u9664\u6D4F\u89C8\u5668\u7F13\u5B58", -1)
                  ])]),
                  _: 1
                })
              ]),
              _: 1
            }, 8, ["onClick"]),
            createVNode(_component_a_doption, { onClick: exportData }, {
              default: withCtx(() => [
                createVNode(Icon, { type: "save" }, {
                  default: withCtx(() => [..._cache[6] || (_cache[6] = [
                    createTextVNode("\u5BFC\u51FA\u6570\u636E", -1)
                  ])]),
                  _: 1
                })
              ]),
              _: 1
            }),
            createVNode(_component_a_doption, {
              class: "border-bottom",
              onClick: importData
            }, {
              default: withCtx(() => [
                createVNode(Icon, { type: "upload" }, {
                  default: withCtx(() => [..._cache[7] || (_cache[7] = [
                    createTextVNode("\u5BFC\u5165\u6570\u636E", -1)
                  ])]),
                  _: 1
                })
              ]),
              _: 1
            }),
            createVNode(_component_a_doption, { onClick: relaunch }, {
              default: withCtx(() => [
                createVNode(Icon, { type: "sync" }, {
                  default: withCtx(() => [..._cache[8] || (_cache[8] = [
                    createTextVNode("\u91CD\u542F\u8F6F\u4EF6", -1)
                  ])]),
                  _: 1
                })
              ]),
              _: 1
            }),
            createVNode(_component_a_doption, { onClick: openLog }, {
              default: withCtx(() => [
                createVNode(Icon, { type: "folder" }, {
                  default: withCtx(() => [..._cache[9] || (_cache[9] = [
                    createTextVNode("\u65E5\u5FD7\u76EE\u5F55", -1)
                  ])]),
                  _: 1
                })
              ]),
              _: 1
            }),
            createVNode(_component_a_doption, { onClick: openDevTools }, {
              default: withCtx(() => [
                createVNode(Icon, { type: "code" }, {
                  default: withCtx(() => [..._cache[10] || (_cache[10] = [
                    createTextVNode("\u5F00\u53D1\u8005\u5DE5\u5177", -1)
                  ])]),
                  _: 1
                })
              ]),
              _: 1
            })
          ]),
          default: withCtx(() => [
            _cache[11] || (_cache[11] = createBaseVNode("span", { class: "title-item" }, " \u5DE5\u5177 ", -1))
          ]),
          _: 1
        }),
        createVNode(CommonEditActionDropdown, null, {
          default: withCtx(() => [
            createBaseVNode("span", {
              class: "title-item",
              onMousedown: _cache[2] || (_cache[2] = (e) => {
                e.preventDefault();
              })
            }, " \u7F16\u8F91 ", 32)
          ]),
          _: 1
        }),
        createVNode(_component_a_dropdown, {
          class: "tittle-dropdown",
          position: "bottom",
          trigger: "hover",
          "popup-max-height": false
        }, {
          content: withCtx(() => [
            createVNode(_component_a_doption, {
              style: { "width": "200px" },
              onClick: unref(about)
            }, {
              default: withCtx(() => [
                createVNode(Icon, { type: "book" }, {
                  default: withCtx(() => [..._cache[12] || (_cache[12] = [
                    createTextVNode("\u4F7F\u7528\u6559\u7A0B", -1)
                  ])]),
                  _: 1
                })
              ]),
              _: 1
            }, 8, ["onClick"]),
            createVNode(_component_a_doption, { onClick: allNotify }, {
              default: withCtx(() => [
                createVNode(Icon, { type: "notes" }, {
                  default: withCtx(() => [..._cache[13] || (_cache[13] = [
                    createTextVNode("\u67E5\u770B\u901A\u77E5", -1)
                  ])]),
                  _: 1
                })
              ]),
              _: 1
            }),
            createVNode(_component_a_doption, { onClick: showVersionLogs }, {
              default: withCtx(() => [
                createVNode(Icon, { type: "notes" }, {
                  default: withCtx(() => [..._cache[14] || (_cache[14] = [
                    createTextVNode("关于与版本", -1)
                  ])]),
                  _: 1
                })
              ]),
              _: 1
            }),
            createVNode(_sfc_main$e, { url: "https://docs.ocsjs.com/" }, {
              title: withCtx(() => [
                createVNode(Icon, { type: "home" }, {
                  default: withCtx(() => [..._cache[15] || (_cache[15] = [
                    createTextVNode("OCS 原项目", -1)
                  ])]),
                  _: 1
                })
              ]),
              _: 1
            })
          ]),
          default: withCtx(() => [
            _cache[16] || (_cache[16] = createBaseVNode("span", { class: "title-item" }, " \u5E2E\u52A9 ", -1))
          ]),
          _: 1
        })
      ]);
    };
  }
});
const Title_vue_vue_type_style_index_0_scoped_3d0afa12_lang = "";
const Title = /* @__PURE__ */ _export_sfc(_sfc_main$b, [["__scopeId", "data-v-3d0afa12"]]);
const _hoisted_1$7 = { key: 1 };
const _hoisted_2$7 = { class: "d-flex mb-3" };
const _hoisted_3$6 = { style: { "float": "right" } };
const _hoisted_4$5 = { class: "d-flex" };
const _sfc_main$a = /* @__PURE__ */ defineComponent({
  __name: "Tags",
  props: {
    tags: {},
    size: { default: "small" },
    readOnly: { type: Boolean, default: false },
    defaultColor: { default: "#808080" }
  },
  emits: ["update:tags", "remove", "create"],
  setup(__props, { emit: __emit }) {
    const object = Object;
    const props = __props;
    const emits = __emit;
    const getOptions = () => object.keys(store.render.browser.tags).map((key) => ({ value: key, label: key, ...store.render.browser.tags[key] })).sort((a, b) => b.count - a.count);
    const options = ref(getOptions());
    const inputRef = ref();
    const state = reactive({
      modalVisible: false,
      inputValue: "",
      color: props.defaultColor
    });
    const handleSearch = (val) => {
      options.value = getOptions().filter((opt) => RegExp(val).test(opt.value));
    };
    const handleClose = (removeTag) => {
      const tags = props.tags.filter((tag) => tag.name !== removeTag.name);
      emits("update:tags", tags);
      emits("remove", removeTag);
    };
    const showModel = () => {
      state.modalVisible = true;
      setTimeout(() => {
        inputRef.value.focus();
      }, 300);
    };
    const handleInputConfirm = () => {
      const inputValue = state.inputValue;
      let tags = props.tags;
      if (inputValue && tags.map((t) => t.name).findIndex((n) => n === inputValue) === -1) {
        const origin_tag = store.render.browser.tags[state.inputValue];
        let newTag;
        if (origin_tag && origin_tag.color !== state.color) {
          newTag = { name: inputValue, color: origin_tag.color };
        } else {
          newTag = { name: inputValue, color: state.color };
        }
        tags = [...tags, newTag];
        emits("create", newTag);
      }
      Object.assign(state, {
        modalVisible: false,
        inputValue: "",
        color: props.defaultColor
      });
      emits("update:tags", tags);
    };
    return (_ctx, _cache) => {
      const _component_a_tooltip = resolveComponent("a-tooltip");
      const _component_a_tag = resolveComponent("a-tag");
      const _component_icon_plus = resolveComponent("icon-plus");
      const _component_a_space = resolveComponent("a-space");
      const _component_a_auto_complete = resolveComponent("a-auto-complete");
      const _component_a_modal = resolveComponent("a-modal");
      return openBlock(), createElementBlock(Fragment, null, [
        __props.readOnly === false || __props.tags.length > 0 ? (openBlock(), createBlock(_component_a_space, {
          key: 0,
          class: "flex-wrap",
          size: 1
        }, {
          default: withCtx(() => [
            (openBlock(true), createElementBlock(Fragment, null, renderList(__props.tags, (tag, index) => {
              return openBlock(), createBlock(_component_a_tag, {
                key: index,
                class: "tag",
                closable: !__props.readOnly,
                color: tag.color,
                size: props.size,
                onClose: ($event) => handleClose(tag)
              }, {
                default: withCtx(() => [
                  tag.name.length > 8 ? (openBlock(), createBlock(_component_a_tooltip, {
                    key: 0,
                    class: "tag",
                    content: tag.name,
                    mini: ""
                  }, {
                    default: withCtx(() => [
                      createBaseVNode("span", null, toDisplayString(`${tag.name.slice(0, 8)}...`), 1)
                    ]),
                    _: 2
                  }, 1032, ["content"])) : (openBlock(), createElementBlock("span", _hoisted_1$7, toDisplayString(tag.name), 1))
                ]),
                _: 2
              }, 1032, ["closable", "color", "size", "onClose"]);
            }), 128)),
            !__props.readOnly ? (openBlock(), createBlock(_component_a_tag, {
              key: 0,
              style: { "border": "1px gray", "border-style": "dashed", "cursor": "pointer" },
              size: props.size,
              onClick: showModel
            }, {
              default: withCtx(() => [
                _cache[4] || (_cache[4] = createTextVNode(" \u6DFB\u52A0 ", -1)),
                createVNode(_component_icon_plus)
              ]),
              _: 1
            }, 8, ["size"])) : createCommentVNode("", true)
          ]),
          _: 1
        })) : createCommentVNode("", true),
        createVNode(_component_a_modal, {
          visible: state.modalVisible,
          "onUpdate:visible": _cache[3] || (_cache[3] = ($event) => state.modalVisible = $event),
          "align-center": "",
          "ok-text": "\u786E\u8BA4",
          "cancel-text": "\u53D6\u6D88",
          title: "\u6DFB\u52A0\u65B0\u6807\u7B7E",
          onOk: handleInputConfirm
        }, {
          default: withCtx(() => [
            createBaseVNode("div", _hoisted_2$7, [
              _cache[5] || (_cache[5] = createBaseVNode("span", { class: "col-2" }, "\u6807\u7B7E\u540D: ", -1)),
              createVNode(_component_a_auto_complete, {
                ref_key: "inputRef",
                ref: inputRef,
                modelValue: state.inputValue,
                "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => state.inputValue = $event),
                placeholder: "\u8F93\u5165\u6807\u7B7E\u540D",
                size: "small",
                style: { "width": "100%" },
                data: options.value,
                onSearch: handleSearch
              }, {
                option: withCtx(({
                  data: {
                    raw: { value, count, color }
                  }
                }) => [
                  createVNode(_component_a_tag, { color }, {
                    default: withCtx(() => [
                      createTextVNode(toDisplayString(value), 1)
                    ]),
                    _: 2
                  }, 1032, ["color"]),
                  createBaseVNode("span", _hoisted_3$6, toDisplayString(count), 1)
                ]),
                _: 1
              }, 8, ["modelValue", "data"])
            ]),
            createBaseVNode("div", _hoisted_4$5, [
              _cache[6] || (_cache[6] = createBaseVNode("span", { class: "col-2" }, "\u6807\u7B7E\u989C\u8272: ", -1)),
              unref(store).render.browser.tags[state.inputValue] ? (openBlock(), createElementBlock("div", {
                key: 0,
                style: normalizeStyle([{ "cursor": "not-allowed", "width": "50px" }, {
                  backgroundColor: unref(store).render.browser.tags[state.inputValue].color
                }]),
                onClick: _cache[1] || (_cache[1] = withModifiers(() => {
                }, ["prevent"]))
              }, null, 4)) : (openBlock(), createBlock(unref(ColorPicker), {
                key: 1,
                hex: state.color,
                "onUpdate:hex": _cache[2] || (_cache[2] = ($event) => state.color = $event),
                "default-color": state.color
              }, null, 8, ["hex", "default-color"]))
            ])
          ]),
          _: 1
        }, 8, ["visible"])
      ], 64);
    };
  }
});
const Tags_vue_vue_type_style_index_0_scoped_cbc44f54_lang = "";
const Tags = /* @__PURE__ */ _export_sfc(_sfc_main$a, [["__scopeId", "data-v-cbc44f54"]]);
const _hoisted_1$6 = ["onClick", "onDblclick", "aria-selected", "onKeydown"];
const _hoisted_2$6 = { class: "d-flex justify-content-center" };
const _hoisted_3$5 = { class: "mt-3 float-end" };
const _hoisted_4$4 = {
  key: 0,
  style: { "font-size": "12px" },
  class: "text-secondary float-end"
};
const _sfc_main$9 = /* @__PURE__ */ defineComponent({
  __name: "CommonSelector",
  props: {
    list: {},
    onSelect: { type: Function },
    multiple: { type: Boolean },
    quickConfirm: { type: Boolean, default: false }
  },
  setup(__props) {
    const props = __props;
    const selected = ref([]);
    const state = reactive({
      page: 1,
      pageSize: 8
    });
    function confirm() {
      props.onSelect(selected.value);
    }
    function select(item) {
      if (props.multiple) {
        const index = selected.value.findIndex((i) => i.key === item.key);
        if (index === -1) {
          selected.value.push(item);
        } else {
          selected.value.splice(index, 1);
        }
      } else {
        selected.value = [item];
      }
    }
    function isSelected(item) {
      return selected.value.find((i) => i.key === item.key) !== void 0;
    }
    return (_ctx, _cache) => {
      const _component_a_empty = resolveComponent("a-empty");
      const _component_a_pagination = resolveComponent("a-pagination");
      const _component_a_button = resolveComponent("a-button");
      const _component_a_space = resolveComponent("a-space");
      return openBlock(), createElementBlock("div", { class: props.quickConfirm ? "fusion-login-selector" : "" }, [
        props.list.length === 0 ? (openBlock(), createBlock(_component_a_empty, {
          key: 0,
          description: "\u6682\u65E0\u6570\u636E"
        })) : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(props.list.slice((state.page - 1) * state.pageSize, state.page * state.pageSize), (item, index) => {
            return openBlock(), createElementBlock("div", {
              key: index,
              class: normalizeClass(["item", {
                selected: isSelected(item)
              }]),
              onClick: ($event) => select(item),
              onDblclick: props.quickConfirm ? () => { selected.value = [item]; confirm(); } : void 0,
              role: "option",
              "aria-selected": isSelected(item),
              tabindex: "0",
              onKeydown: ($event) => { if ($event.key === " " || $event.key === "Enter") { $event.preventDefault(); select(item); if (props.quickConfirm && $event.key === "Enter") { selected.value = [item]; confirm(); } } }
            }, [
              renderSlot(_ctx.$slots, "content", { item }, () => [
                createTextVNode(toDisplayString(item.key), 1)
              ], true)
            ], 10, _hoisted_1$6);
          }), 128)),
          createBaseVNode("div", _hoisted_2$6, [
            createVNode(_component_a_pagination, {
              total: props.list.length,
              "show-size-changer": false,
              "show-quick-jumper": true,
              "show-total": true,
              "hide-on-single-page": true,
              "default-current": 1,
              "default-page-size": state.pageSize,
              onChange: _cache[0] || (_cache[0] = (page) => state.page = page)
            }, null, 8, ["total", "default-page-size"])
          ]),
          createBaseVNode("div", _hoisted_3$5, [
            createVNode(_component_a_space, null, {
              default: withCtx(() => [
                props.multiple ? (openBlock(), createElementBlock("span", _hoisted_4$4, " \u5171\u9009\u4E2D " + toDisplayString(selected.value.length) + " \u4E2A ", 1)) : createCommentVNode("", true),
                createVNode(_component_a_button, {
                  style: { "width": "100px" },
                  type: "primary",
                  onClick: confirm
                }, {
                  default: withCtx(() => [..._cache[1] || (_cache[1] = [
                    createTextVNode(" \u786E\u5B9A ", -1)
                  ])]),
                  _: 1
                })
              ]),
              _: 1
            })
          ])
        ], 64))
      ]);
    };
  }
});
const CommonSelector_vue_vue_type_style_index_0_scoped_ebddc3fe_lang = "";
const CommonSelector = /* @__PURE__ */ _export_sfc(_sfc_main$9, [["__scopeId", "data-v-ebddc3fe"]]);
const _hoisted_1$5 = {
  style: { "font-size": "12px" },
  class: "text-secondary float-end"
};
const _hoisted_2$5 = { key: 0 };
const _hoisted_3$4 = { key: 0 };
const _sfc_main$8 = /* @__PURE__ */ defineComponent({
  __name: "PlaywrightScriptSelector",
  props: {
    playwrightScripts: { default: () => [] },
    multiple: { type: Boolean, default: true }
  },
  emits: ["update:playwrightScripts", "confirm"],
  setup(__props, { emit: __emit }) {
    const state = reactive({
      search: ""
    });
    const props = __props;
    const emits = __emit;
    const RawScripts = remote.methods.callSync("getRawScripts");
    console.log("RawScripts", RawScripts);
    const scripts = computed(() => RawScripts.filter((s) => s.name.includes(state.search)));
    function confirm(selectedScripts) {
      emits("update:playwrightScripts", JSON.parse(JSON.stringify(selectedScripts)));
      emits("confirm");
    }
    return (_ctx, _cache) => {
      const _component_a_input_search = resolveComponent("a-input-search");
      return openBlock(), createElementBlock("div", null, [
        createVNode(_component_a_input_search, {
          modelValue: state.search,
          "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => state.search = $event),
          size: "small",
          class: "mb-2",
          placeholder: "输入自动登录配置名称搜索"
        }, null, 8, ["modelValue"]),
        createVNode(CommonSelector, {
          quickConfirm: true,
          multiple: props.multiple,
          list: scripts.value.filter((s) => s.name.includes(state.search)).map((s) => ({ key: s.name, ...s })),
          "on-select": confirm
        }, {
          content: withCtx(({ item: script }) => [
            createBaseVNode("b", null, toDisplayString(script.name), 1),
            createBaseVNode("span", _hoisted_1$5, [
              _cache[1] || (_cache[1] = createBaseVNode("span", null, " \u9700\u914D\u7F6E : ", -1)),
              (openBlock(true), createElementBlock(Fragment, null, renderList(script.configs, (cfg, key, i) => {
                return openBlock(), createElementBlock("span", {
                  key: cfg.label
                }, [
                  !cfg.hide ? (openBlock(), createElementBlock("span", _hoisted_2$5, [
                    i !== 0 ? (openBlock(), createElementBlock("span", _hoisted_3$4, " , ")) : createCommentVNode("", true),
                    createTextVNode(" " + toDisplayString(cfg.label), 1)
                  ])) : createCommentVNode("", true)
                ]);
              }), 128))
            ])
          ]),
          _: 1
        }, 8, ["multiple", "list"])
      ]);
    };
  }
});
const PlaywrightScriptSelector_vue_vue_type_style_index_0_scoped_ffdf7a75_lang = "";
const PlaywrightScriptSelector = /* @__PURE__ */ _export_sfc(_sfc_main$8, [["__scopeId", "data-v-ffdf7a75"]]);
const FusionAccountName = defineComponent({
 name:'FusionAccountName',props:{uid:{}},setup(props){
  const name=computed(()=>fusionAccountNames.get(props.uid)||'');let alive=true,timer,busy=false;
  async function refresh(){if(!alive||busy||document.hidden||!props.uid||!window.xingchanBridge)return;busy=true;const uid=props.uid;try{const saved=await window.xingchanBridge.getSettings({uid});if(alive&&uid===props.uid)cacheFusionAccountName(uid,saved.displayName||'');}catch{}finally{busy=false;}}
  onMounted(()=>{void refresh();timer=setInterval(refresh,2500);window.addEventListener('fusion-login-verified',refresh);});
  onBeforeUnmount(()=>{alive=false;clearInterval(timer);window.removeEventListener('fusion-login-verified',refresh);});watch(()=>props.uid,()=>{void refresh();});
  return()=>h('span',{class:'fusion-account-name-row'},[
    h('span',{'data-account-name':props.uid,title:'来自登录验证或已登录的浏览器、星蝉会话'},name.value||'尚未获取，验证登录或启动后自动更新'),
    name.value && Browser.from(props.uid)?.name !== name.value ? h(Button,{type:'text',size:'mini',class:'ms-2',onClick:()=>{
      const account=Browser.from(props.uid);if(account&&name.value)account.rename(name.value);
    }},()=> '同步到名称') : null
  ]);
 }
});
const FusionLoginVerification = defineComponent({
  name:'FusionLoginVerification',props:{uid:{},playwrightScripts:{}},
  setup(props){
    const feedback=reactive({busy:false,state:'',message:'',info:null});let alive=true,generation=0,savedTimer;
    const current=()=>window.FusionLoginProfiles?.parse(props.playwrightScripts)||{kind:'none',username:'',password:'',unit:'',reason:'登录模块尚未就绪'};
    const signature=()=>window.FusionLoginProfiles?.signature(current());
    async function savedInfo(){
      const operation=generation,uid=props.uid,login=current(),stamp=signature();if(!alive||feedback.busy||!uid||!window.xingchanBridge?.getSettings)return;
      try{await window.FusionWorkspace?.flushCredentials?.();const saved=await window.xingchanBridge.getSettings({uid});if(!alive||operation!==generation||uid!==props.uid||signature()!==stamp||feedback.busy)return;
        const digest=require('node:crypto').createHash('sha256').update(stamp).digest('hex');if(saved.nativeLoginIdentity===digest&&saved.verifiedDetails){feedback.info=saved.verifiedDetails;feedback.message='上次登录验证取得的资料';feedback.state='success';}
      }catch{}
    }
    watch(()=>[props.uid,signature()],()=>{generation++;feedback.busy=false;feedback.state='';feedback.message='';feedback.info=null;clearTimeout(savedTimer);savedTimer=setTimeout(savedInfo,220);},{flush:'sync'});
    onMounted(()=>{savedTimer=setTimeout(savedInfo,0);});
    onBeforeUnmount(()=>{alive=false;generation++;clearTimeout(savedTimer);});
    async function verify(){
      if(feedback.busy)return;
      try{await window.FusionWorkspace?.flushCredentials?.();}catch{return;}
      const profiles=window.FusionLoginProfiles,login={...current()},uid=props.uid,stamp=profiles?.signature(login);if(feedback.busy||!profiles?.complete(login)||!profiles.kinds[login.kind]||!window.xingchanBridge?.verifyLogin)return;
      const operation=++generation;feedback.busy=true;feedback.state='waiting';feedback.info=null;feedback.message='正在后台验证账号；需要本人处理时会打开验证窗口…';
      const valid=()=>alive&&operation===generation&&props.uid===uid&&signature()===stamp;
      try{
        await window.FusionWorkspace?.flushCredentials?.();
        const result=await window.xingchanBridge.verifyLogin({uid,login});if(!valid())return;
        const labels={success:'登录验证成功',invalid:'账号或密码不正确',challenge:'需要本人验证', 'network-error':'网络异常，本次未能验证',unverified:'本次未能确认登录结果'};
        feedback.state=Object.hasOwn(labels,result?.state)?result.state:'unverified';let message=typeof result?.message==='string'?result.message:labels[feedback.state];if(login.password)message=message.split(login.password).join('[已隐藏]');feedback.message=message.slice(0,400);
        if(feedback.state==='success'){feedback.info={...(result.info||{}),name:result.info?.name||result.name||''};window.dispatchEvent(new Event('fusion-login-verified'));}
      }catch(error){if(valid()){feedback.state='unverified';feedback.message=/正在运行|活动任务|请先关闭|请先停止/.test(String(error?.message))?'请先停止本账号正在运行的任务，再验证登录。':'本次验证未完成，请稍后重试。';}}
      finally{login.password='';if(valid())feedback.busy=false;}
    }
    return()=>{
      const profiles=window.FusionLoginProfiles,login=current(),ready=!!props.uid&&!!profiles?.kinds[login.kind]&&profiles.complete(login);
      const details=feedback.info?Object.entries({name:'姓名',school:'学校',studentId:'学号',userId:'用户 ID'}).filter(([key])=>typeof feedback.info[key]==='string'&&feedback.info[key]).flatMap(([key,label])=>[h('dt',{},label),h('dd',{},feedback.info[key])]):[];
      return h('div',{class:'fusion-login-verification'},[h('button',{type:'button',class:'fusion-button',disabled:feedback.busy||!ready||!window.xingchanBridge?.verifyLogin,'aria-label':'验证本账号当前登录配置',onClick:event=>{event.preventDefault();event.stopPropagation();void verify();}},feedback.busy?'验证中…':'验证登录'),h('span',{class:'fusion-login-verification-note'},ready?'后台验证账号；需要本人处理时打开验证窗口。':login.reason||'请补全账号、密码及所需学校信息。'),feedback.message?h('p',{class:'fusion-login-verification-result','data-state':feedback.state,role:'status'},feedback.message):null,details.length?h('dl',{class:'fusion-login-information','aria-label':'登录账号资料'},details):null]);
    };
  }
});

const _sfc_main$7 = /* @__PURE__ */ defineComponent({
  __name: "PlaywrightScriptList",
  props: {
    uid: {},
    playwrightScripts: {}
  },
  emits: ["update:playwrightScripts"],
  setup(__props) {
    const drafts = reactive(new Map()), pending = new Map(), clearing = reactive(new Set());
    function identityField(script, key) {
      const spec = window.FusionAutomationConfigs?.loginSpec(script);
      return spec && (key === 'loginType' || key === spec.username || key === spec.unit);
    }
    function commit(script, key, cfg) {
      if (pending.has(cfg)) return pending.get(cfg);
      if (!drafts.has(cfg)) return Promise.resolve(true);
      const value = drafts.get(cfg).value.trim(), uid = __props.uid;
      const job = Promise.resolve().then(async () => {
        const account = Browser.from(uid);
        if (!account || !account.playwrightScripts.includes(script)) return true;
        if (value !== cfg.value) {
          const scripts = JSON.parse(JSON.stringify(account.playwrightScripts));
          scripts[account.playwrightScripts.indexOf(script)].configs[key].value = value;
          if (!await confirmFusionDuplicates([{name:account.name, playwrightScripts:scripts}], uid)) return false;
          if (Browser.from(uid)?.playwrightScripts.includes(script)) cfg.value = value;
        }
        return true;
      }).finally(() => { drafts.delete(cfg); pending.delete(cfg); });
      pending.set(cfg, job);return job;
    }
    async function flush() {
      for (const [cfg, draft] of [...drafts]) if (!await commit(draft.script, draft.key, cfg)) return false;
      return true;
    }
    async function clearLogin(script){
      if(clearing.has(script))return;clearing.add(script);
      try{
        const confirmed=await window.FusionDialogs.show({title:'清空自动登录配置',message:'清空本账号“'+script.name+'”中的账号、密码及学校等登录字段，浏览器与星蝉的登录配置同步清空。保留账号条目、登录方式、题库和课程数据。',buttons:['取消','确认清空'],defaultId:0,cancelId:0});
        if(confirmed.response!==1)return;
        await Promise.all([...pending.values()]);for(const [cfg,draft]of drafts)if(draft.script===script)drafts.delete(cfg);
        if(!writeFusionNativeCredentials({uid:__props.uid,script,clear:true}))throw Error('登录配置已变化，请重新打开账号设置后再清空。');
        await nextTick();await window.FusionWorkspace?.flushCredentials?.();await window.__fusionSaveStore?.();
        window.FusionWorkspace?.notify?.('本账号的自动登录配置已清空。');
      }catch(error){await window.FusionDialogs.alert(String(error?.message||'清空未完成，请重试。'));}
      finally{clearing.delete(script);}
    }
    fusionLoginEditors.add(flush);
    onBeforeUnmount(() => {void flush().catch(()=>{});fusionLoginEditors.delete(flush);});
    return (_ctx, _cache) => {
      fusionLoginProfileRevision.value;
      const _component_a_divider = resolveComponent("a-divider");
      const _component_a_col = resolveComponent("a-col");
      const _component_a_input = resolveComponent("a-input");
      const _component_a_row = resolveComponent("a-row");
      return openBlock(true), createElementBlock(Fragment, null, renderList(__props.playwrightScripts, (script, index) => {
        return openBlock(), createElementBlock("div", {
          key: index,
          class: "shadow-sm rounded ps"
        }, [
          createBaseVNode("div", {class:"fusion-login-card-heading"}, [createBaseVNode("span",null,toDisplayString(script.name),1),window.FusionLoginProfiles?.definitions[script.name]?createBaseVNode("button",{type:"button",class:"xc-poc-button xc-danger-button fusion-login-clear",disabled:clearing.has(script),title:"清空此登录方式的账号、密码和学校信息，保留账号条目及其他配置。",onClick:event=>{event.preventDefault();event.stopPropagation();void clearLogin(script);}},clearing.has(script)?"清空中…":"清空",8,["disabled"]):createCommentVNode("",true)]),
          createVNode(_component_a_divider, { class: "mb-1 mt-1" }),
          (openBlock(true), createElementBlock(Fragment, null, renderList(script.configs, (cfg, configKey) => {
            return openBlock(), createElementBlock("div", {
              key: cfg.label,
              class: "ps-item"
            }, [
              (window.FusionAutomationConfigs?.visible(script,cfg) ?? !cfg.hide) ? (openBlock(), createBlock(_component_a_row, { key: 0 }, {
                default: withCtx(() => [
                  createVNode(_component_a_col, { flex: "100px" }, {
                    default: withCtx(() => [
                      createBaseVNode("span", null, toDisplayString(cfg.label), 1)
                    ]),
                    _: 2
                  }, 1024),
                  createVNode(_component_a_col, { flex: "auto" }, {
                    default: withCtx(() => [
                      createVNode(cfg.type==='select'?resolveComponent('a-select'):_component_a_input, {
                        modelValue: drafts.get(cfg)?.value ?? cfg.value,
                        "onUpdate:modelValue": ($event) => {
                          if(identityField(script,configKey)){drafts.set(cfg,{value:$event,script,key:configKey});if(cfg.type==='select')void commit(script,configKey,cfg).catch(()=>Message.error('登录方式未能保存，请重试。'));}
                          else cfg.value=$event;
                        },
                        options: cfg.options,
                        placeholder: cfg.placeholder || '',
                        'aria-label': cfg.label,
                        size: "mini",
                        onBlur: () => {
                          if(identityField(script,configKey))void commit(script,configKey,cfg).catch(()=>Message.error('账号配置未能保存，请重试。'));
                          else if(cfg!==script.configs.password)cfg.value=cfg.value.trim();
                        }
                      }, null, 8, ["modelValue", "onUpdate:modelValue", "onBlur"])
                    ]),
                    _: 2
                  }, 1024)
                ]),
                _: 2
              }, 1024)) : createCommentVNode("", true)
            ]);
          }), 128)),
          window.FusionLoginProfiles?.definitions[script.name] ? createVNode(FusionLoginVerification,{uid:__props.uid,playwrightScripts:__props.playwrightScripts},null,8,["uid","playwrightScripts"]) : createCommentVNode("",true)
        ]);
      }), 128);
    };
  }
});
const PlaywrightScriptList_vue_vue_type_style_index_0_scoped_40c47d77_lang = "";
const PlaywrightScripts = /* @__PURE__ */ _export_sfc(_sfc_main$7, [["__scopeId", "data-v-40c47d77"]]);
const fitAddon = new xtermAddonFit.exports.FitAddon();
class XTerm$1 extends xterm.exports.Terminal {
  constructor(options) {
    super(
      Object.assign(
        {
          cursorBlink: true,
          convertEol: true,
          fontFamily: "Consolas, 'Courier New', monospace",
          fontSize: 12,
          theme: { background: "#32302F" },
          rows: 40
        },
        options
      )
    );
    this.loadAddon(fitAddon);
    this.onKey((key) => {
      const char = key.domEvent.key;
      if (key.domEvent.ctrlKey && char === "c") {
        remote.webContents.call("copy");
      }
    });
    window.onresize = () => {
      this.fit();
    };
  }
  fit() {
    try {
      fitAddon.fit();
    } catch {
    }
  }
  write(data) {
    super.write(data);
    this.fit();
  }
  writeln(data, callback) {
    super.writeln(data, callback);
    this.fit();
  }
  clear() {
    super.clear();
  }
}
const _sfc_main$6 = /* @__PURE__ */ defineComponent({
  __name: "XTerm",
  props: {
    uid: {}
  },
  setup(__props) {
    const props = __props;
    const xterm2 = new XTerm$1();
    const xtermRef = ref();
    let fold;const fitWhenOpened=()=>{if(fold?.open)requestAnimationFrame(()=>xterm2.fit());};
    onMounted(() => {
      openXTerm();
      fold=xtermRef.value?.closest('details');fold?.addEventListener('toggle',fitWhenOpened);
    });
    onBeforeUnmount(()=>fold?.removeEventListener('toggle',fitWhenOpened));
    function openXTerm() {
      var _a2, _b2;
      const process2 = Process.from(props.uid);
      xterm2.open(xtermRef.value);
      xterm2.clear();
      for (const log of (process2 == null ? void 0 : process2.logs) || []) {
        xterm2.write(log);
      }
      if (process2 == null ? void 0 : process2.shell) {
        (_a2 = process2.shell.stdout) == null ? void 0 : _a2.on("data", (data) => xterm2.write(data));
        (_b2 = process2.shell.stderr) == null ? void 0 : _b2.on("data", (data) => xterm2.write(`[\u9519\u8BEF] : ${data}`));
      }
      xterm2.fit();
    }
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", {
        ref_key: "xtermRef",
        ref: xtermRef,
        class: "xterm-container"
      }, null, 512);
    };
  }
});
const XTerm_vue_vue_type_style_index_0_scoped_6f4e5fb2_lang = "";
const XTerm = /* @__PURE__ */ _export_sfc(_sfc_main$6, [["__scopeId", "data-v-6f4e5fb2"]]);
const _hoisted_1$4 = {
  id: "bp-tags",
  "data-label": "\u6807\u7B7E\u5206\u7C7B"
};
const _hoisted_2$4 = {
  id: "bp-playwright-scripts",
  class: "fusion-login-container",
  "data-label": "自动登录配置"
};
const _hoisted_3$3 = { class: "mt-2" };
const _hoisted_4$3 = {
  class: "m-3",
  style: { "height": "70vh", "overflow": "overlay" }
};
const _hoisted_5$2 = {
  id: "bp-xterm",
  class: "fusion-account-fold",
  "data-label": "\u65E5\u5FD7\u8F93\u51FA"
};
const _hoisted_6$2 = {
  id: "bp-file-history",
  "data-label": "\u64CD\u4F5C\u5386\u53F2",
  class: "histories fusion-account-fold"
};
const _hoisted_7$2 = { style: { "text-overflow": "ellipsis", "overflow": "hidden", "display": "-webkit-box", "-webkit-line-clamp": "3", "-webkit-box-orient": "vertical" } };
const _sfc_main$5 = /* @__PURE__ */ defineComponent({
  __name: "BrowserPanel",
  props: {
    browser: {}
  },
  setup(__props) {
    const props = __props;
    const instance = Browser.from(props.browser.uid);
    const profileElement = ref();
    const state = reactive({
      showCode: false,
      renaming: false,
      showPlaywrightScriptSelector: store.render.browser.fusionSelectLoginUid===props.browser.uid
    });
    if(state.showPlaywrightScriptSelector)delete store.render.browser.fusionSelectLoginUid;
    function createTag(tag) {
      var _a2;
      if (store.render.browser.tags[tag.name]) {
        store.render.browser.tags[tag.name].count += 1;
      } else {
        store.render.browser.tags[tag.name] = {
          color: tag.color,
          count: 1
        };
        (_a2 = currentBrowser.value) == null ? void 0 : _a2.histories.unshift({
          action: "\u6DFB\u52A0\u6807\u7B7E",
          content: tag.name,
          time: Date.now()
        });
      }
    }
    function removeTag(tag) {
      var _a2;
      if (store.render.browser.tags[tag.name] && store.render.browser.tags[tag.name].count > 1) {
        store.render.browser.tags[tag.name].count -= 1;
      } else {
        Reflect.deleteProperty(store.render.browser.tags, tag.name);
      }
      (_a2 = currentBrowser.value) == null ? void 0 : _a2.histories.unshift({ action: "\u5220\u9664\u6807\u7B7E", content: tag.name, time: Date.now() });
    }
    function clearHistory() {
      if (currentBrowser.value) {
        currentBrowser.value.histories = [];
      }
    }
    function rename() {
      state.renaming = true;
      nextTick(() => {
        var _a2, _b2;
        (_b2 = (_a2 = profileElement.value) == null ? void 0 : _a2.querySelector("#bp-rename")) == null ? void 0 : _b2.focus();
      });
    }
    onMounted(() => {
      nextTick(() => {
        const configs = Array.from(document.querySelectorAll("[id^=bp-]"));
        const toc = document.createElement("div");
        toc.classList.add("bp-toc");
        const bp = document.querySelector("#browser-panel");
        const drawer = document.querySelector("#browser-panel .arco-drawer");
        if (bp && drawer) {
          bp.prepend(toc);
          toc.style.right = drawer.clientWidth + "px";
          for (const el of configs) {
            const div = document.createElement("div");
            div.textContent = el.dataset.label || "";
            div.addEventListener("click", () => {
              el.scrollIntoView();
            });
            toc.append(div);
          }
        }
      });
    });
    return (_ctx, _cache) => {
      const _component_a_input = resolveComponent("a-input");
      const _component_a_button = resolveComponent("a-button");
      const _component_a_descriptions_item = resolveComponent("a-descriptions-item");
      const _component_a_descriptions = resolveComponent("a-descriptions");
      const _component_a_divider = resolveComponent("a-divider");
      const _component_a_textarea = resolveComponent("a-textarea");
      const _component_icon_settings = resolveComponent("icon-settings");
      const _component_a_tooltip = resolveComponent("a-tooltip");
      const _component_a_modal = resolveComponent("a-modal");
      const _component_a_table = resolveComponent("a-table");
      const _component_a_empty = resolveComponent("a-empty");
      return openBlock(), createElementBlock("div", {
        ref_key: "profileElement",
        ref: profileElement,
        class: "overflow-auto profile"
      }, [
        createVNode(_component_a_descriptions, { column: 1 }, {
          default: withCtx(() => [
            createVNode(_component_a_descriptions_item, { label: "账号名称" }, {
              default: withCtx(() => [
                state.renaming ? (openBlock(), createBlock(_component_a_input, {
                  key: 0,
                  id: "bp-rename",
                  modelValue: unref(instance).name,
                  "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => unref(instance).name = $event),
                  size: "mini",
                  onBlur: _cache[1] || (_cache[1] = () => {
                    var _a2;
                    (_a2 = unref(instance)) == null ? void 0 : _a2.rename(unref(instance).name);
                    state.renaming = false;
                  })
                }, null, 8, ["modelValue"])) : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                  createTextVNode(toDisplayString(unref(instance).name) + " ", 1),
                  createVNode(_component_a_button, {
                    type: "text",
                    size: "mini",
                    class: "ms-2",
                    onClick: rename
                  }, {
                    default: withCtx(() => [..._cache[12] || (_cache[12] = [
                      createTextVNode(" \u91CD\u547D\u540D ", -1)
                    ])]),
                    _: 1
                  })
                ], 64))
              ]),
              _: 1
            }),
            createVNode(_component_a_descriptions_item,{label:"账号姓名"},{default:withCtx(()=>[createVNode(FusionAccountName,{uid:unref(instance).uid})])}),
            createVNode(_component_a_descriptions_item, { label: "\u521B\u5EFA\u65F6\u95F4" }, {
              default: withCtx(() => [
                createTextVNode(toDisplayString(unref(datetime)(unref(instance).createTime)), 1)
              ]),
              _: 1
            }),
            createVNode(_component_a_descriptions_item, { label: "所属分组" }, {
              default: withCtx(() => {
                var _a2;
                return [
                  createTextVNode(toDisplayString((_a2 = unref(Folder).from(unref(instance).parent)) == null ? void 0 : _a2.flatParents().map((f) => f.name).join(" / ")) + " ", 1),
                  createVNode(_component_a_button, {
                    type: "text",
                    size: "mini",
                    onClick: _cache[2] || (_cache[2] = ($event) => {
                      var _a3;
                      return (_a3 = unref(instance)) == null ? void 0 : _a3.location();
                    })
                  }, {
                    default: withCtx(() => [..._cache[13] || (_cache[13] = [
                      createTextVNode(" \u8DF3\u8F6C\u5230\u8BE5\u76EE\u5F55 ", -1)
                    ])]),
                    _: 1
                  })
                ];
              }),
              _: 1
            }),
            createVNode(_component_a_descriptions_item, { label: "\u7F13\u5B58\u8DEF\u5F84" }, {
              default: withCtx(() => [
                createTextVNode(toDisplayString(unref(instance).cachePath), 1)
              ]),
              _: 1
            })
          ]),
          _: 1
        }),
        createVNode(_component_a_divider, { class: "mt-1 mb-1" }),
        unref(instance) ? (openBlock(), createBlock(_component_a_descriptions, {
          key: 0,
          column: 1,
          size: "large"
        }, {
          default: withCtx(() => [
            createVNode(_component_a_descriptions_item, { label: "自动登录配置" }, {
              default: withCtx(() => [
                createBaseVNode("div", _hoisted_2$4, [
                  createVNode(_component_a_tooltip, null, {
                    content: withCtx(() => [
                      _cache[14] || (_cache[14] = createTextVNode(" \u542F\u52A8\u6D4F\u89C8\u5668\u540E\u4F1A\u8FD0\u884C \u201C自动登录配置\u201D\u3002\u6BCF\u4E2A自动登录配置\u4F1A\u5F00\u542F\u4E00\u4E2A\u65B0\u7684\u9875\u9762\u3002 \u9009\u62E9\u5E76\u786E\u5B9A\u540E, \u9700\u8981\u5728\u6D4F\u89C8\u5668\u8BBE\u7F6E\u91CC\u4FEE\u6539\u914D\u7F6E\u3002 ", -1)),
                      createVNode(_component_a_divider, { class: "mt-1 mb-1" }),
                      _cache[15] || (_cache[15] = createTextVNode(" \u63D0\u793A1\uFF1A自动登录配置\u62E5\u6709\u64CD\u63A7\u9875\u9762\u7684\u6240\u6709\u6743\u9650\uFF0C\u4E0E\u7528\u6237\u811A\u672C\u4E0D\u540C\u7684\u662F\uFF0C\u7528\u6237\u811A\u672C\u662F\u8FD0\u884C\u5728\u9875\u9762\u4E2D\uFF0C\u6743\u9650\u6BD4\u8F83\u5C11\u3002", -1)),
                      _cache[16] || (_cache[16] = createBaseVNode("br", null, null, -1)),
                      _cache[17] || (_cache[17] = createTextVNode(" \u63D0\u793A2\uFF1A\u901A\u5E38\u7528\u6765\u8F85\u52A9\u7528\u6237\u811A\u672C\u4E00\u8D77\u914D\u5408\u8FD0\u884C\u3002", -1)),
                      _cache[18] || (_cache[18] = createBaseVNode("br", null, null, -1)),
                      _cache[19] || (_cache[19] = createTextVNode(" \u63D0\u793A3\uFF1A\u8F93\u5165\u7684\u914D\u7F6E\u4F8B\u5982\u8D26\u53F7\u5BC6\u7801\u5C06\u7531\u8F6F\u4EF6\u52A0\u5BC6\u5B58\u50A8\uFF0C\u4EE5\u4FDD\u8BC1\u6570\u636E\u5B89\u5168\u3002 ", -1))
                    ]),
                    default: withCtx(() => [
                      createVNode(_component_a_button, {
                        class: "fusion-login-button",
                        onClick: _cache[5] || (_cache[5] = ($event) => state.showPlaywrightScriptSelector = true)
                      }, {
                        default: withCtx(() => [
                          _cache[20] || (_cache[20] = createTextVNode(" 自动登录配置 ", -1)),
                          createVNode(_component_icon_settings)
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  }),
                  createBaseVNode("div", _hoisted_3$3, [
                    createVNode(PlaywrightScripts, {
                      uid: unref(instance).uid,
                      "playwright-scripts": unref(instance).playwrightScripts,
                      "onUpdate:playwrightScripts": _cache[6] || (_cache[6] = ($event) => unref(instance).playwrightScripts = $event)
                    }, null, 8, ["uid", "playwright-scripts"])
                  ])
                ])
              ]),
              _: 1
            }),
            createVNode(_component_a_descriptions_item, { label: "入学年份" }, {
              default: withCtx(() => [createBaseVNode("div", {id:"bp-enrollment-year","data-label":"入学年份"})]), _:1
            }),
            createVNode(_component_a_descriptions_item, { label: "浏览器播放" }, {
              default: withCtx(() => [createBaseVNode("div", {id:"bp-browser-behavior","data-label":"浏览器播放"})]), _:1
            }),
            createVNode(_component_a_descriptions_item, { label: "\u6807\u7B7E\u5206\u7C7B" }, {
              default: withCtx(() => [
                createBaseVNode("div", _hoisted_1$4, [
                  createVNode(Tags, {
                    tags: unref(instance).tags,
                    "onUpdate:tags": _cache[3] || (_cache[3] = ($event) => unref(instance).tags = $event),
                    size: "small",
                    onCreate: createTag,
                    onRemove: removeTag
                  }, null, 8, ["tags"])
                ])
              ]),
              _: 1
            }),
            createVNode(_component_a_descriptions_item, { label: "\u5907\u6CE8\u63CF\u8FF0" }, {
              default: withCtx(() => [
                createVNode(_component_a_textarea, {
                  id: "bp-notes",
                  modelValue: unref(instance).notes,
                  "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => unref(instance).notes = $event),
                  "data-label": "\u5907\u6CE8\u63CF\u8FF0",
                  placeholder: "\u5907\u6CE8\u4E3A\u7A7A~",
                  "auto-size": {
                    minRows: 2,
                    maxRows: 10
                  },
                  "allow-clear": ""
                }, null, 8, ["modelValue"])
              ]),
              _: 1
            }),
          ]), _: 1
        })) : createCommentVNode("",true),
        unref(instance) ? (openBlock(),createElementBlock("div",{key:2,class:"fusion-account-details"},[
          createVNode(_component_a_descriptions,{column:1,size:"large"},{default:withCtx(()=>[
            createVNode(_component_a_descriptions_item, { label: "账号数据" }, {
              default: withCtx(() => [
                createVNode(_component_a_button, {
                  id: "bp-file-data",
                  "data-label": "账号数据",
                  size: "mini",
                  onClick: _cache[7] || (_cache[7] = ($event) => state.showCode = true)
                }, {
                  default: withCtx(() => [..._cache[21] || (_cache[21] = [
                    createTextVNode(" \u70B9\u51FB\u67E5\u770B ", -1)
                  ])]),
                  _: 1
                }),
                createVNode(_component_a_modal, {
                  visible: state.showCode,
                  "onUpdate:visible": _cache[8] || (_cache[8] = ($event) => state.showCode = $event),
                  footer: false,
                  simple: true,
                  width: 600,
                  "modal-class": "p-0 m-0"
                }, {
                  default: withCtx(() => [
                    createBaseVNode("div", _hoisted_4$3, [
                      createVNode(_component_a_textarea, {
                        "auto-size": true,
                        disabled: true,
                        "model-value": JSON.stringify(unref(instance), null, 4)
                      }, null, 8, ["model-value"])
                    ])
                  ]),
                  _: 1
                }, 8, ["visible"])
              ]),
              _: 1
            }),
          ]),_:1}),
          createBaseVNode("div",{class:"fusion-fold-group"},[
                createBaseVNode("details", _hoisted_5$2, [
                  createBaseVNode("summary",null,"日志输出"),
                  createBaseVNode("div",{class:"fusion-fold-body"},[createVNode(XTerm, {
                    uid: unref(instance).uid
                  }, null, 8, ["uid"])])
                ]),
                createBaseVNode("details", _hoisted_6$2, [
                  createBaseVNode("summary",null,"操作历史"),
                  createBaseVNode("div",{class:"fusion-fold-body"},[
                  unref(instance).histories.length ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
                    createVNode(_component_a_button, {
                      size: "mini",
                      class: "mb-2"
                    }, {
                      default: withCtx(() => [
                        createVNode(Icon, {
                          type: "delete",
                          onClick: clearHistory
                        }, {
                          default: withCtx(() => [..._cache[22] || (_cache[22] = [
                            createTextVNode(" \u6E05\u7A7A ", -1)
                          ])]),
                          _: 1
                        })
                      ]),
                      _: 1
                    }),
                    createVNode(_component_a_table, {
                      size: "small",
                      data: unref(instance).histories.sort((a, b) => b.time - a.time),
                      pagination: {
                        pageSizeOptions: [10, 20, 50, 100],
                        showPageSize: true,
                        size: "mini"
                      },
                      columns: [
                        {
                          title: "\u64CD\u4F5C",
                          dataIndex: "action",
                          width: 100
                        },
                        {
                          title: "\u5907\u6CE8",
                          dataIndex: "content",
                          slotName: "content"
                        },
                        {
                          dataIndex: "time",
                          title: "\u65F6\u95F4",
                          slotName: "time",
                          width: 160
                        }
                      ]
                    }, {
                      time: withCtx(({ record }) => [
                        createTextVNode(toDisplayString(unref(datetime)(record.time)), 1)
                      ]),
                      content: withCtx(({ record }) => [
                        createVNode(_component_a_tooltip, {
                          content: record.content || "\u65E0\u5907\u6CE8"
                        }, {
                          default: withCtx(() => [
                            createBaseVNode("div", _hoisted_7$2, toDisplayString(record.content || "-"), 1)
                          ]),
                          _: 2
                        }, 1032, ["content"])
                      ]),
                      _: 1
                    }, 8, ["data"])
                  ], 64)) : (openBlock(), createBlock(_component_a_empty, { key: 1 }))])
                ])
          ])
        ])) : createCommentVNode("", true),
        createVNode(_component_a_modal, {
          visible: state.showPlaywrightScriptSelector,
          "onUpdate:visible": _cache[11] || (_cache[11] = ($event) => state.showPlaywrightScriptSelector = $event),
          footer: false
        }, {
          title: withCtx(() => [..._cache[23] || (_cache[23] = [
            createTextVNode(" \u9009\u62E9自动登录配置 ", -1)
          ])]),
          default: withCtx(() => [
            createVNode(PlaywrightScriptSelector, {
              "playwright-scripts": unref(instance).playwrightScripts,
              "onUpdate:playwrightScripts": _cache[9] || (_cache[9] = ($event) => unref(instance).playwrightScripts = $event),
              style: { "max-height": "70vh", "overflow": "overlay" },
              onConfirm: _cache[10] || (_cache[10] = ($event) => state.showPlaywrightScriptSelector = false)
            }, null, 8, ["playwright-scripts"])
          ]),
          _: 1
        }, 8, ["visible"])
      ], 512);
    };
  }
});
const BrowserPanel_vue_vue_type_style_index_0_scoped_faf19c28_lang = "";
const BrowserPanel = /* @__PURE__ */ _export_sfc(_sfc_main$5, [["__scopeId", "data-v-faf19c28"]]);
async function getWindowsRelease() {
  const release = await remote.os.call("release");
  if (release.startsWith("6.1")) {
    return "win7";
  } else if (parseInt(release.split(".").at(-1) || "0") > 22e3) {
    return "win11";
  } else {
    return "win10";
  }
}
class ResourceLoader {
  constructor(options) {
    __publicField(this, "resourceRootPath");
    this.resourceRootPath = options.resourceRootPath;
  }
  async getPath(group_name, file) {
    return await remote.path.call("join", this.resourceRootPath, group_name, file.id);
  }
  async isExists(group_name, file) {
    const path = await this.getPath(group_name, file);
    return await remote.fs.call("existsSync", path);
  }
  isZipFile(file) {
    return /\.(zip|rar|7z)$/.test(file.url);
  }
  async getUnzippedPath(group_name, file) {
    return await remote.path.call("join", this.resourceRootPath, group_name, file.id);
  }
  async isZipFileExists(group_name, file) {
    if (this.isZipFile(file)) {
      const path = await this.getUnzippedPath(group_name, file);
      return await remote.fs.call("existsSync", path);
    }
    return false;
  }
  async download(group_name, file) {
    var _a2, _b2;
    const downloadPath = await remote.path.call(
      "join",
      this.resourceRootPath,
      group_name,
      this.isZipFile(file) ? file.id + ".zip" : file.id
    );
    if (await remote.fs.call("existsSync", downloadPath)) {
      await remote.fs.call("unlinkSync", downloadPath);
    }
    const platform = await remote.methods.call("getPlatform");
    const url = platform === "win32" ? file.url : ((_b2 = (_a2 = file.platforms) == null ? void 0 : _a2.find((p) => p.platform === platform)) == null ? void 0 : _b2.url) || file.url;
    if (!url) {
      throw new Error("\u8D44\u6E90\u4E0B\u8F7D\u5931\u8D25\uFF0C\u8DEF\u5F84\u4E3A\u7A7A");
    }
    await remote.methods.call("download", "download-file-" + file.id, url, downloadPath);
    return downloadPath;
  }
  async unzip(group_name, file) {
    const targetPath = await remote.path.call(
      "join",
      this.resourceRootPath,
      group_name,
      this.isZipFile(file) ? file.id + ".zip" : file.id
    );
    const to = await remote.path.call("join", this.resourceRootPath, group_name, file.id);
    if (await remote.fs.call("existsSync", to)) {
      await remote.fs.call("rmSync", to, {
        recursive: true
      });
    }
    await remote.methods.call("unzip", targetPath, to);
    await remote.fs.call("unlinkSync", targetPath);
    return to;
  }
  async remove(group_name, file) {
    if (this.isZipFile(file)) {
      const path = await this.getUnzippedPath(group_name, file);
      await remote.fs.call("rmSync", path, {
        recursive: true
      });
    } else {
      const path = await this.getPath(group_name, file);
      await remote.fs.call("unlinkSync", path);
    }
  }
  async list() {
    const files = [];
    const groupnames = await remote.fs.call("readdirSync", this.resourceRootPath);
    for (const groupname of groupnames.filter((g) => g !== ".DS_Store")) {
      const folder = await remote.path.call("join", this.resourceRootPath, groupname);
      if (await remote.fs.call("existsSync", folder)) {
        const isDirectory = await remote.methods.callSync("isDirectory", folder);
        if (!isDirectory)
          continue;
        try {
          const filenames = await remote.fs.call("readdirSync", folder);
          for (const filename of filenames) {
            const path = await remote.path.call("join", folder, filename);
            files.push({ groupname, filename, path });
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
    return files;
  }
}
const resourceLoader$1 = new ResourceLoader({
  resourceRootPath: (_a = store.paths) == null ? void 0 : _a.downloadFolder
});
async function installExtensions(extensions, extension, options) {
  if (!(options == null ? void 0 : options.force_install) && extensions.filter((e) => e.installed).length > 0) {
    Message.success({
      content: `\u811A\u672C\u7BA1\u7406\u5668 ${extension.name} \u5DF2\u4E0B\u8F7D`,
      duration: 10 * 1e3
    });
    return;
  }
  await resourceLoader$1.download("extensions", extension);
  notify("\u6587\u4EF6\u89E3\u538B", `${extension.name} \u89E3\u538B\u4E2D...`, "download-file-" + extension.name, {
    type: "info",
    duration: 0
  });
  const filepath = await resourceLoader$1.unzip("extensions", extension);
  notify("\u6587\u4EF6\u4E0B\u8F7D", `${extension.name} \u4E0B\u8F7D\u5B8C\u6210\uFF01`, "download-file-" + extension.name, {
    type: "success",
    duration: 3e3
  });
  extension.installed = true;
  return filepath;
}
function addScriptFromFile() {
  remote.dialog.call("showOpenDialog", {
    title: "\u9009\u62E9\u811A\u672C\u6587\u4EF6\uFF0C\u540E\u7F00\u5FC5\u987B\u4E3A (.user.js)",
    buttonLabel: "\u6DFB\u52A0\u811A\u672C",
    filters: [{ extensions: ["user.js"], name: "\u7528\u6237\u811A\u672C" }]
  }).then(async ({ canceled, filePaths }) => {
    if (canceled === false && filePaths.length) {
      const text = await remote.fs.call("readFileSync", filePaths[0], { encoding: "utf8" });
      await addLocalScript(filePaths[0], text.toString());
    }
  });
}
async function addLocalScript(uri, text) {
  if (await remote.fs.call("existsSync", uri)) {
    const metadata = getMetadataFromScript(text);
    if (metadata === void 0) {
      Message.error("\u811A\u672C\u683C\u5F0F\u4E0D\u6B63\u786E\uFF0C\u8BF7\u9009\u62E9\u80FD\u591F\u89E3\u6790\u7684\u7528\u6237\u811A\u672C\u3002");
    } else {
      if (store.render.scripts.find((s) => s.url === uri)) {
        Message.warning("\u5F53\u524D\u811A\u672C\u5DF2\u5B89\u88C5\u3002");
      } else {
        const id = Date.now();
        store.render.scripts.push({
          id,
          url: uri,
          enable: true,
          isLocalScript: true,
          isInternetLinkScript: false,
          info: {
            id,
            url: uri,
            code_url: uri,
            ratings: 0,
            total_installs: 0,
            daily_installs: 0,
            create_time: 0,
            update_time: 0,
            ...metadata
          }
        });
      }
    }
  } else {
    Message.warning("\u6587\u4EF6\u4E0D\u5B58\u5728\u3002");
  }
}
async function addScriptFromUrl(url) {
  if (store.render.scripts.find((s) => s.url === url)) {
    Message.success("\u5F53\u524D\u811A\u672C\u5DF2\u5B89\u88C5\u3002");
    return false;
  }
  if (url.startsWith("http")) {
    const text = await remote.methods.call("get", url);
    const metadata = getMetadataFromScript(text);
    if (metadata === void 0) {
      Message.error("\u811A\u672C\u683C\u5F0F\u4E0D\u6B63\u786E\uFF0C\u8BF7\u9009\u62E9\u80FD\u591F\u89E3\u6790\u7684\u7528\u6237\u811A\u672C\u3002");
      return false;
    } else {
      const id = Math.round(Math.random() * 1e13);
      store.render.scripts.push({
        id,
        url,
        enable: true,
        isLocalScript: false,
        isInternetLinkScript: true,
        info: {
          id,
          url,
          code_url: url,
          ratings: 0,
          total_installs: 0,
          daily_installs: 0,
          create_time: 0,
          update_time: 0,
          ...metadata
        }
      });
    }
  } else {
    Message.error("\u811A\u672C\u94FE\u63A5\u65E0\u6548\uFF0C\u5FC5\u987B\u662F\u4EE5 http \u5F00\u5934\u7684\u7F51\u7EDC\u94FE\u63A5\u3002");
    return false;
  }
  return true;
}
function getMetadataFromScript(text) {
  var _a2;
  const metadata = ((_a2 = text.match(/\/\/\s+==UserScript==([\s\S]+)\/\/\s+==\/UserScript==/)) == null ? void 0 : _a2[1]) || "";
  if (metadata === "") {
    return void 0;
  } else {
    const metadataList = (metadata.match(/\/\/\s+@(.+?)\s+(.*?)(?:\n|$)/g) || []).map((line) => {
      const words = line.match(/[\S]+/g) || [];
      return {
        key: (words[1] || "").replace("@", ""),
        value: words.slice(2).join(" ")
      };
    });
    const getMetadata = (key) => {
      return metadataList.filter((l) => l.key === key).map((l) => l.value);
    };
    return {
      authors: getMetadata("author").map((a) => ({ name: a, url: "" })) || [],
      description: getMetadata("description")[0],
      license: getMetadata("license")[0],
      name: getMetadata("name")[0],
      version: getMetadata("version")[0]
    };
  }
}
function openScriptSource(script) {
  if (script.info) {
    if (script.info.url.startsWith("http")) {
      window.open(script.info.url, "_blank");
    } else {
      electron.shell.openPath(script.info.url);
    }
  }
}
const resourceLoader = new ResourceLoader({
  resourceRootPath: (_b = store == null ? void 0 : store.paths) == null ? void 0 : _b.downloadFolder
});
const Environment = {
  infos: ref(void 0),
  loading: ref(false),
  async init() {
    if (!this.infos.value)
      this.infos.value = await this.getRemoteInfos();
  },
  async getRemoteInfos() {
    if (!this.infos.value) {
      this.loading.value = true;
      this.infos.value = await getRemoteInfos();
      this.loading.value = false;
    }
    return this.infos.value;
  },
  async getSupportedBrowser() {
    let browsers = await Promise.all(
      [
        {
          name: "\u9ED8\u8BA4\u8BBE\u7F6E\u6D4F\u89C8\u5668",
          path: store.render.setting.launchOptions.executablePath || ""
        },
        ...await remote.methods.call("getValidBrowsers")
      ].filter((b) => b.path && remote.fs.callSync("existsSync", b.path)).map(async (b) => {
        return {
          ...b,
          major_version: await remote.methods.call("getBrowserMajorVersion", b.path)
        };
      })
    );
    browsers = browsers.sort((a, b) => (b.major_version || 0) - (a.major_version || 0));
    if (browsers.some((b) => b.major_version && b.major_version <= 137)) {
      const valid_version_browser = browsers.find(
        (_, i) => (browsers == null ? void 0 : browsers[i]) && ((browsers == null ? void 0 : browsers[i].major_version) || 999) <= 137
      );
      return valid_version_browser;
    }
  },
  async isCurrentBrowserSupported() {
    const current_browser_path = store.render.setting.launchOptions.executablePath;
    if (!current_browser_path)
      return false;
    const current_browser_version = await remote.methods.call("getBrowserMajorVersion", current_browser_path);
    if (current_browser_version && current_browser_version <= 137) {
      return true;
    }
    return false;
  },
  async getExtensions() {
    var _a2;
    const infos = await this.getRemoteInfos();
    const extensions = ((_a2 = infos.resourceGroups.find((group) => group.name === "extensions")) == null ? void 0 : _a2.files) || [];
    for (const extension of extensions) {
      extension.installed = await resourceLoader.isZipFileExists("extensions", extension);
    }
    return extensions;
  },
  async getSupportedExtension() {
    var _a2;
    const infos = await this.getRemoteInfos();
    const extensions = ((_a2 = infos.resourceGroups.find((group) => group.name === "extensions")) == null ? void 0 : _a2.files) || [];
    for (const extension of extensions) {
      extension.installed = await resourceLoader.isZipFileExists("extensions", extension);
    }
    const installed_extension = extensions.find((e) => e.installed);
    if (!installed_extension)
      return;
    const manifest = JSON.parse(
      String(
        await remote.fs.call(
          "readFileSync",
          await remote.path.call(
            "join",
            await resourceLoader.getUnzippedPath("extensions", installed_extension),
            "manifest.json"
          ),
          "utf-8"
        )
      )
    );
    if (get_1(manifest, "manifest_version", 2) < 3) {
      return void 0;
    }
    return installed_extension;
  },
  async getValidUserScript() {
    var _a2;
    const infos = await this.getRemoteInfos();
    const userScripts = ((_a2 = infos == null ? void 0 : infos.resourceGroups.find((group) => group.name === "userjs")) == null ? void 0 : _a2.files) || [];
    const default_user_script = userScripts[0];
    if (!default_user_script) {
      return;
    }
    return default_user_script;
  }
};
const _hoisted_1$3 = {
  key: 0,
  class: "text-center"
};
const _hoisted_2$3 = {
  key: 1,
  class: "text-center text-danger"
};
const _hoisted_3$2 = {
  key: 0,
  class: "text-danger"
};
const _hoisted_4$2 = {
  key: 1,
  style: { "white-space": "pre-wrap", "text-align": "left", "font-size": "12px" }
};
const _sfc_main$4 = /* @__PURE__ */ defineComponent({
  __name: "Setup",
  props: {
    visible: { type: Boolean, default: false },
    confirmText: { default: "\u4E00\u952E\u521D\u59CB\u5316" },
    cancelText: { default: "\u7A0D\u540E\u624B\u52A8\u8BBE\u7F6E" },
    title: { default: "\u521D\u59CB\u5316\u8F6F\u4EF6\u8BBE\u7F6E" },
    createNewBrowser: { type: Boolean, default: true }
  },
  emits: ["finish", "error", "update:visible"],
  setup(__props, { emit: __emit }) {
    const state = reactive({
      current_step: -1,
      steps: []
    });
    const props = __props;
    const emits = __emit;
    onMounted(async () => {
      await Environment.init();
      prepare();
    });
    watch(
      () => props.visible,
      () => {
        nextTick(async () => {
          await Environment.init();
          prepare();
        });
      }
    );
    function notNow() {
      emits("update:visible", false);
    }
    function prepare() {
      try {
        state.steps = [];
        state.current_step = -1;
        state.steps.push({
          title: "\u7B49\u5F85\u521D\u59CB\u5316...",
          description: lang("setup_modal_notice", ""),
          async action(step) {
          }
        });
        state.steps.push({
          title: "\u521D\u59CB\u5316\u6D4F\u89C8\u5668",
          async action(step) {
            var _a2, _b2, _c;
            step.description = "\u6B63\u5728\u68C0\u6D4B\u53EF\u7528\u6D4F\u89C8\u5668...";
            const valid_version_browser = await Environment.getSupportedBrowser();
            if (valid_version_browser) {
              store.render.setting.launchOptions.executablePath = valid_version_browser.path;
              step.description += `
\u8BBE\u7F6E\u6D4F\u89C8\u5668\u8DEF\u5F84\u4E3A\uFF1A ${valid_version_browser.name} - ${valid_version_browser.path}`;
              return;
            }
            step.description = "未检测到受支持的本地浏览器。";
            step.error = "请在“软件设置”中选择本机受支持的浏览器可执行文件并重试；如果内置浏览器文件缺失，请使用学不通 2.5.12 安装包进行本地修复。";
          }
        });
        state.steps.push({
          title: "\u521D\u59CB\u5316\u6D4F\u89C8\u5668\u62D3\u5C55",
          async action(step) {
            step.description = "\u6B63\u5728\u83B7\u53D6\u8FDC\u7A0B\u8D44\u6E90\u4FE1\u606F...";
            const extensions = await Environment.getExtensions();
            const install_new = async () => {
              const default_extension = extensions[0];
              if (!default_extension) {
                step.error = "\u672A\u68C0\u6D4B\u5230\u53EF\u7528\u811A\u672C\u7BA1\u7406\u5668\u62D3\u5C55\uFF0C\u8BF7\u5C1D\u8BD5\u91CD\u542F\u8F6F\u4EF6\u3002";
                return;
              }
              step.description += `
\u5171\u68C0\u6D4B\u5230 ${extensions.length} \u4E2A\u811A\u672C\u7BA1\u7406\u5668\u62D3\u5C55\uFF0C\u6B63\u5728\u5B89\u88C5...`;
              const default_extension_filepath = await installExtensions(extensions, default_extension, {
                force_install: true
              });
              if (!default_extension_filepath) {
                step.error = "\u811A\u672C\u7BA1\u7406\u5668\u5B89\u88C5\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\uFF0C\u6216\u8005\u7A0D\u540E\u5728\u5DE6\u4FA7\u5E94\u7528\u4E2D\u5FC3\u624B\u52A8\u5B89\u88C5\u3002";
                return;
              }
              step.description += `
\u5DF2\u5B89\u88C5\u811A\u672C\u7BA1\u7406\u5668\uFF1A${default_extension.name} - ${default_extension.url}`;
            };
            if (!extensions.every((ext) => ext.installed)) {
              return install_new();
            }
            const supported_extension = await Environment.getSupportedExtension();
            if (!supported_extension) {
              step.description = lang(
                "setup_error_auto_download_new_extension_when_version_too_low",
                "\u5F53\u524D\u811A\u672C\u7BA1\u7406\u5668\u7248\u672C\u8F83\u4F4E\uFF0C\u9700\u8981\u66F4\u65B0\u62D3\u5C55\u5230\u6700\u65B0MV3\u7248\u672C"
              );
              try {
                await new Promise((resolve, reject) => {
                  Modal.confirm({
                    title: "\u8B66\u544A",
                    content: step.description || "",
                    maskClosable: false,
                    closable: false,
                    cancelText: "\u53D6\u6D88",
                    okText: "\u4E00\u952E\u66F4\u65B0",
                    onCancel(e) {
                      reject(new Error("\u4F60\u5DF2\u53D6\u6D88\u66F4\u65B0\uFF0C\u8BF7\u81EA\u884C\u5728\u5DE6\u4FA7\u5E94\u7528\u4E2D\u5FC3\u66F4\u65B0\u62D3\u5C55\u6216\u8005\u91CD\u65B0\u521D\u59CB\u5316\u3002"));
                    },
                    async onOk() {
                      await install_new();
                      resolve();
                    }
                  });
                });
              } catch (err) {
                step.error = err;
                return;
              }
              return;
            }
            step.description = `\u5DF2\u5B89\u88C5\u811A\u672C\u7BA1\u7406\u5668\uFF1A${supported_extension.name} - ${supported_extension.url}`;
          }
        });
        state.steps.push({
          title: "\u521D\u59CB\u5316\u811A\u672C",
          async action(step) {
            const default_user_script = await Environment.getValidUserScript();
            if (!default_user_script) {
              step.error = "\u672A\u68C0\u6D4B\u5230\u53EF\u7528\u811A\u672C\uFF0C\u8BF7\u7A0D\u540E\u5728\u5DE6\u4FA7\u8F6F\u4EF6\u8BBE\u7F6E\u4E2D\u8BBE\u7F6E\u3002";
              return;
            }
            step.description = `\u6B63\u5728\u5B89\u88C5\u9ED8\u8BA4\u811A\u672C\uFF1A` + default_user_script.name;
            await addScriptFromUrl(default_user_script.url);
            step.description = `\u5DF2\u5B89\u88C5\u7528\u6237\u811A\u672C\uFF1A${default_user_script.name} - ${default_user_script.url}`;
          }
        });
        if (props.createNewBrowser) {
          state.steps.push({
            title: "添加账号",
            action(step) {
              const children = root().listChildren();
              if (children.length !== 0) {
                step.description = "已存在账号，无需重复添加。";
                return;
              }
              const name = "未命名账号";
              newBrowser({
                name
              });
              step.description = `\u5DF2\u521B\u5EFA\u6D4F\u89C8\u5668\uFF1A${name}\uFF0C\u53EF\u7A0D\u540E\u5728\u5DE6\u4FA7\u8F6F\u4EF6\u8BBE\u7F6E\u4E2D\u4FEE\u6539\u540D\u79F0`;
            }
          });
          state.steps.push({
            title: "\u6D4F\u89C8\u5668\u542F\u52A8\u6D4B\u8BD5",
            async action(step) {
              const children = root().listChildren();
              if (children.length === 0) {
                step.error = "\u672A\u68C0\u6D4B\u5230\u6D4F\u89C8\u5668\uFF0C\u8BF7\u7A0D\u540E\u5728\u5DE6\u4FA7\u8F6F\u4EF6\u8BBE\u7F6E\u4E2D\u521B\u5EFA\u6D4F\u89C8\u5668\u3002";
                return;
              }
              const browser = children[0];
              const instance = Browser.from(browser.uid);
              if (!instance) {
                step.error = "\u672A\u68C0\u6D4B\u5230\u6D4F\u89C8\u5668\uFF0C\u8BF7\u7A0D\u540E\u5728\u5DE6\u4FA7\u8F6F\u4EF6\u8BBE\u7F6E\u4E2D\u521B\u5EFA\u6D4F\u89C8\u5668\u3002";
                return;
              }
              try {
                const code = await instance.launch();
                if (typeof code === "number") {
                  step.error = "\u6D4F\u89C8\u5668\u542F\u52A8\u6D4B\u8BD5\u5931\u8D25\uFF0C\u8BF7\u67E5\u770B\u53F3\u4FA7\u8BE6\u7EC6\u9519\u8BEF\u4FE1\u606F\u3002";
                  return;
                } else {
                  step.description = "\u6D4F\u89C8\u5668\u542F\u52A8\u6D4B\u8BD5\u6210\u529F\uFF0C\u5373\u5C06\u81EA\u52A8\u5173\u95ED";
                  instance.close();
                }
              } catch (err) {
                step.error = "\u6D4F\u89C8\u5668\u542F\u52A8\u6D4B\u8BD5\u5931\u8D25\uFF1A" + err;
              }
            }
          });
          state.steps.push({
            title: "\u521D\u59CB\u5316\u5B8C\u6210",
            async action(step) {
              step.description = lang("setup_finish_notice", "");
            }
          });
        }
      } catch (err) {
        console.error(err);
        Message.error(String(err));
        emits("error", String(err));
      }
    }
    async function setup() {
      if (state.steps.length > 0) {
        prepare();
      }
      state.current_step = 0;
      try {
        for (const step of state.steps) {
          step.status = "wait";
          step.description = "";
          step.error = "";
        }
        let error = false;
        for (const step of state.steps) {
          if (error) {
            step.hidden = true;
            continue;
          }
          step.status = "process";
          await step.action(step);
          if (step.error) {
            step.status = "error";
            error = true;
          } else {
            step.status = "finish";
          }
          state.current_step += 1;
          await sleep(200);
        }
        if (state.steps.every((s) => s.status === "finish")) {
          Message.success("\u521D\u59CB\u5316\u5B8C\u6210\uFF01");
        }
      } catch (err) {
        console.error(err);
        Message.error("\u5B89\u88C5\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\uFF0C\u6216\u8005\u624B\u52A8\u8BBE\u7F6E : " + err);
        emits("error", String(err));
      }
    }
    return (_ctx, _cache) => {
      const _component_a_spin = resolveComponent("a-spin");
      const _component_a_col = resolveComponent("a-col");
      const _component_icon_check = resolveComponent("icon-check");
      const _component_icon_close = resolveComponent("icon-close");
      const _component_icon_loading = resolveComponent("icon-loading");
      const _component_a_step = resolveComponent("a-step");
      const _component_a_steps = resolveComponent("a-steps");
      const _component_a_button = resolveComponent("a-button");
      const _component_a_space = resolveComponent("a-space");
      const _component_a_row = resolveComponent("a-row");
      const _component_a_modal = resolveComponent("a-modal");
      return openBlock(), createBlock(_component_a_modal, {
        visible: props.visible,
        footer: false,
        closable: false,
        onClose: _cache[1] || (_cache[1] = () => {
          emits("update:visible", false);
        })
      }, {
        title: withCtx(() => [
          createTextVNode(toDisplayString(props.title), 1)
        ]),
        default: withCtx(() => [
          createVNode(_component_a_row, { gutter: [24, 24] }, {
            default: withCtx(() => [
              !unref(Environment).infos.value ? (openBlock(), createBlock(_component_a_col, { key: 0 }, {
                default: withCtx(() => [
                  unref(Environment).loading ? (openBlock(), createElementBlock("div", _hoisted_1$3, [
                    createVNode(_component_a_spin),
                    _cache[2] || (_cache[2] = createBaseVNode("div", { class: "mt-2" }, "\u6B63\u5728\u521D\u59CB\u5316\u8D44\u6E90\uFF0C\u8BF7\u7A0D\u540E...", -1))
                  ])) : (openBlock(), createElementBlock("div", _hoisted_2$3, "\u672A\u80FD\u83B7\u53D6\u5230\u8FDC\u7A0B\u8D44\u6E90\u4FE1\u606F\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u540E\u91CD\u8BD5\uFF0C\u6216\u8005\u7A0D\u540E\u624B\u52A8\u8BBE\u7F6E\u3002"))
                ]),
                _: 1
              })) : (openBlock(), createBlock(_component_a_col, {
                key: 1,
                class: "text-center"
              }, {
                default: withCtx(() => [
                  createVNode(_component_a_steps, {
                    direction: "vertical",
                    current: state.current_step
                  }, {
                    default: withCtx(() => [
                      (openBlock(true), createElementBlock(Fragment, null, renderList(state.steps, (step, index) => {
                        return withDirectives((openBlock(), createBlock(_component_a_step, {
                          key: index,
                          title: step[0],
                          status: step.status
                        }, createSlots({
                          description: withCtx(() => [
                            step.error ? (openBlock(), createElementBlock("div", _hoisted_3$2, toDisplayString(step.error), 1)) : step.description ? (openBlock(), createElementBlock("div", _hoisted_4$2, toDisplayString(step.description), 1)) : createCommentVNode("", true)
                          ]),
                          default: withCtx(() => [
                            createTextVNode(" " + toDisplayString(step.title), 1)
                          ]),
                          _: 2
                        }, [
                          step.status ? {
                            name: "icon",
                            fn: withCtx(() => [
                              step.status === "finish" ? (openBlock(), createBlock(_component_icon_check, {
                                key: 0,
                                style: { "color": "green" }
                              })) : step.status === "error" ? (openBlock(), createBlock(_component_icon_close, { key: 1 })) : step.status === "process" ? (openBlock(), createBlock(_component_icon_loading, { key: 2 })) : createCommentVNode("", true)
                            ]),
                            key: "0"
                          } : void 0
                        ]), 1032, ["title", "status"])), [
                          [vShow, !step.hidden]
                        ]);
                      }), 128))
                    ]),
                    _: 1
                  }, 8, ["current"])
                ]),
                _: 1
              })),
              createVNode(_component_a_col, { class: "text-center mt-2" }, {
                default: withCtx(() => [
                  createVNode(_component_a_space, { size: 24 }, {
                    default: withCtx(() => [
                      state.current_step === state.steps.length ? (openBlock(), createBlock(_component_a_button, {
                        key: 0,
                        type: "primary",
                        size: "small",
                        onClick: _cache[0] || (_cache[0] = () => {
                          emits("finish");
                          emits("update:visible", false);
                        })
                      }, {
                        default: withCtx(() => [..._cache[3] || (_cache[3] = [
                          createTextVNode(" \u5B8C\u6210\uFF01 ", -1)
                        ])]),
                        _: 1
                      })) : state.current_step === -1 || state.steps.find((s) => s.status === "error") ? (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                        createVNode(_component_a_button, {
                          size: "small",
                          onClick: notNow
                        }, {
                          default: withCtx(() => [
                            createTextVNode(toDisplayString(props.cancelText), 1)
                          ]),
                          _: 1
                        }),
                        createVNode(_component_a_button, {
                          type: "primary",
                          size: "small",
                          onClick: setup
                        }, {
                          default: withCtx(() => [
                            createTextVNode(toDisplayString(props.confirmText), 1)
                          ]),
                          _: 1
                        })
                      ], 64)) : (openBlock(), createBlock(_component_a_button, {
                        key: 2,
                        size: "small",
                        disabled: true
                      }, {
                        default: withCtx(() => [
                          createVNode(_component_icon_loading),
                          _cache[4] || (_cache[4] = createTextVNode(" \u521D\u59CB\u5316\u4E2D... ", -1))
                        ]),
                        _: 1
                      }))
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              })
            ]),
            _: 1
          })
        ]),
        _: 1
      }, 8, ["visible"]);
    };
  }
});
const Setup_vue_vue_type_style_index_0_scoped_35d005e7_lang = "";
const Setup = /* @__PURE__ */ _export_sfc(_sfc_main$4, [["__scopeId", "data-v-35d005e7"]]);
const { ipcRenderer } = electron;
function activeIpcRenderListener() {
  ipcRenderer.on("update-download", (e, rate, totalLength, chunkLength) => {
    notify(
      "学不通更新提示",
      `\u66F4\u65B0\u4E2D: ${(chunkLength / 1024 / 1024).toFixed(2)}MB/${(totalLength / 1024 / 1024).toFixed(2)}MB`,
      "updater",
      {
        type: "info",
        duration: 0,
        close: false
      }
    );
  });
  ipcRenderer.on("show-browser-in-app", (e, uid) => {
    store.render.browser.currentBrowserUid = uid;
  });
  ipcRenderer.on("detect-new-app-version", (_event, new_version) => {
    if(!new_version)return;
    Modal.confirm({title:"学不通统一更新",content:"请使用学不通的统一安装包更新或修复软件。来自基础组件的版本信息仅供参考；本地版本为学不通 2.5.12。",okText:"关于与版本",cancelText:"关闭",maskClosable:false,onOk:()=>openFusionAbout()});
  });
}
const _sfc_main$3 = /* @__PURE__ */ defineComponent({
  __name: "BrowserOperators",
  props: {browser:{}, tooltipPosition:{default:"top"}, iconClass:{default:"fs-6"}},
  setup(props, context) {
    const native = computed(() => Process.from(props.browser.uid));
    const star = computed(() => fusionBrowserProcesses.get(props.browser.uid));
    function action(label, symbol, run, disabled, secondary=false,variant='',caption=label) {
      return h("button", {type:"button",class:["fusion-launch-button",secondary&&"fusion-compact-button",variant&&"fusion-action-"+variant],title:label,"aria-label":label,disabled,
        onClick:event=>{event.preventDefault();event.stopPropagation();Promise.resolve().then(run).catch(error=>window.FusionWorkspace?.notifyError(error));}},
        [h("span",{class:symbol==="progress_activity"?"fusion-busy-spinner":"material-icons-outlined","aria-hidden":"true"},symbol==="progress_activity"?"":symbol),...(!secondary?[h("span",{class:"fusion-action-caption"},symbol==="progress_activity"?(label.startsWith("关闭")?"关闭中":"启动中"):caption)]:[])]);
    }
    return () => {
      fusionLoginProfileRevision.value;
      const browser=Browser.from(props.browser.uid);
      if (!browser) return null;
      const p=native.value,s=star.value,busy=p&&["launching","closing"].includes(p.status),live=p?.status==="launched";
      const starBusy=s&&["launching","closing"].includes(s.status),starLive=s?.status==="launched";
      const login=window.FusionLoginProfiles?.parse(browser.playwrightScripts),starAllowed=login?.starEligible===true&&window.FusionLoginProfiles.complete(login);
      const nativeMain=action(busy?(p.status==="closing"?"关闭浏览器中":"启动浏览器中"):live?"置顶浏览器":"启动浏览器",busy?"progress_activity":live?"open_in_new":"play_arrow",()=>live?browser.bringToFront():browser.launch(),busy);
      const starMain=action(starBusy?(s.status==="closing"?"关闭星蝉中":"启动星蝉中"):"启动星蝉",starBusy?"progress_activity":"play_arrow",()=>fusionBrowserActions.current.start(browser.uid),starBusy||!starAllowed||!fusionBrowserActions.current);
      const pair=(mode,restart,stop,disabled=false)=>h('span',{class:'fusion-running-split','data-running-mode':mode},[action('重启'+(mode==='browser'?'浏览器':'星蝉'),'restart_alt',restart,disabled,false,'restart','重启'),action('停止'+(mode==='browser'?'浏览器':'星蝉'),'stop',stop,false,false,'stop','停止')]);
      return h("div",{class:"fusion-dual-launch",onClick:event=>event.stopPropagation()},[
        h("div",{class:"fusion-launch-group", "data-launch-mode":"browser"},[live?pair('browser',()=>browser.relaunch(),()=>browser.close()):nativeMain,h("span",{class:"fusion-mode-access"},live?[action("置顶浏览器","open_in_new",()=>browser.bringToFront(),false,true)]:p?.status==="launching"?[action("取消启动浏览器","close",()=>browser.close(),false,true,"stop")]:[])]),
        h("div",{class:"fusion-launch-group", "data-launch-mode":"xingchan",title:starAllowed?'':login?.reason||'请补全学习通登录配置'},[starLive?pair('xingchan',()=>fusionBrowserActions.current.restart(browser.uid),()=>fusionBrowserActions.current.stop(browser.uid),!starAllowed):starMain,h("span",{class:"fusion-mode-access"},starLive?[action("启动控制面板","dashboard",()=>fusionBrowserActions.current.openHtml(browser.uid),false,true)]:s?.status==="launching"?[action("取消启动星蝉","close",()=>fusionBrowserActions.current.stop(browser.uid),false,true,"stop")]:[])]),
        context.slots.extra?.()
      ]);
    };
  }
});

const BrowserOperators_vue_vue_type_style_index_0_scoped_2c3a0735_lang = "";
const BrowserOperators = /* @__PURE__ */ _export_sfc(_sfc_main$3, [["__scopeId", "data-v-2c3a0735"]]);
const _hoisted_1$2 = { class: "d-flex w-100 align-items-center" };
const _hoisted_2$2 = {
  style: { "flex": "1 1 auto" },
  class: "d-flex justify-content-end"
};
const _sfc_main$2 = /* @__PURE__ */ defineComponent({
  __name: "BrowserPanelOperators",
  props: {
    browser: {}
  },
  setup(__props) {
    return (_ctx, _cache) => {
      const _component_a_divider = resolveComponent("a-divider");
      const _component_a_button = resolveComponent("a-button");
      const _component_a_tooltip = resolveComponent("a-tooltip");
      return openBlock(), createElementBlock("div", _hoisted_1$2, [
        _cache[2] || (_cache[2] = createBaseVNode("div", { style: { "flex": "0 0 84px" } }, "账号设置", -1)),
        createBaseVNode("div", _hoisted_2$2, [
          createVNode(BrowserOperators, {
            browser: __props.browser,
            "tooltip-position": "br",
            "icon-class": "fs-4",
            class: "ps-3 pe-5"
          }, {
            split: withCtx(() => [
              createVNode(_component_a_divider, { direction: "vertical" })
            ]),
            extra: withCtx(() => [
              createVNode(_component_a_tooltip, { position: "br" }, {
                content: withCtx(() => [..._cache[1] || (_cache[1] = [
                  createTextVNode(" \u4EC5\u6253\u5F00\u6D4F\u89C8\u5668\uFF0C\u4E0D\u6267\u884C\u5176\u4ED6\u64CD\u4F5C\u3002", -1),
                  createBaseVNode("br", null, null, -1),
                  createTextVNode(" \u6B64\u65B9\u6CD5\u53EF\u4EE5\u9632\u6B62\u5404\u79CD\u6D4F\u89C8\u5668\u73AF\u5883\u95EE\u9898\uFF1A", -1),
                  createBaseVNode("br", null, null, -1),
                  createTextVNode(" - \u65E0\u6CD5\u6253\u5F00\u7279\u6B8A\u7684\u8D85\u661F\u7F51\u9875", -1),
                  createBaseVNode("br", null, null, -1),
                  createTextVNode(" - \u5F39\u7A97\u81EA\u52A8\u88AB\u5173\u95ED\u7B49\u7B49\u95EE\u9898 ", -1),
                  createBaseVNode("br", null, null, -1),
                  createTextVNode(" \u5982\u679C\u4F60\u5E76\u6CA1\u6709\u9047\u5230\u8FD9\u4E9B\u95EE\u9898\uFF0C\u53EF\u4EE5\u4E0D\u4F7F\u7528\u6B64\u65B9\u6CD5\uFF0C\u53EF\u4EE5\u76F4\u63A5\u4F7F\u7528\u84DD\u8272\u7684\u542F\u52A8\u6309\u94AE\u3002 ", -1)
                ])]),
                default: withCtx(() => [
                  createVNode(_component_a_button, {
                    size: "mini",
                    onClick: _cache[0] || (_cache[0] = ($event) => __props.browser.onlyLaunch())
                  }, {
                    default: withCtx(() => [
                      createVNode(Icon, { type: "web" })
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              })
            ]),
            _: 1
          }, 8, ["browser"])
        ])
      ]);
    };
  }
});
const _hoisted_1$1 = { class: "row h-100 w-100 p-0 m-0" };
const _hoisted_2$1 = { class: "col p-0 m-0" };
const _hoisted_3$1 = { class: "row main h-100 w-100 p-0 m-0" };
const _hoisted_4$1 = { class: "col-12 p-0 m-0" };
const _hoisted_5$1 = { class: "col-12 p-0 m-0 overflow-auto d-flex" };
const _hoisted_6$1 = { class: "col-auto sider h-100" };
const _hoisted_7$1 = ["onClick"];
const _hoisted_8$1 = {
  key: 0,
  class: "ms-2 sider-item-title text-secondary"
};
const _hoisted_9$1 = {class:"text-secondary version mb-1 ms-2",role:"button",tabindex:0,title:"关于学不通 2.5.12","aria-label":"关于学不通版本","data-fusion-native-about":"true",style:{cursor:"pointer"},onClick:openFusionAbout,onKeydown:event=>{if(event.key==='Enter'||event.key===' ')openFusionAbout(event);}};
const _sfc_main$1 = /* @__PURE__ */ defineComponent({
  __name: "index",
  setup(__props) {
    const { ipcRenderer: ipcRenderer2 } = electron;
    const version = ref("学不通 2.5.12");
    const currentRoute = useRouter().currentRoute;
    const state = reactive({
      sideBarWidth: computed(() => store.render.setting.showSideBarText ? 142 : 56)
    });
    onUnmounted(() => closeAllBrowser());
    onMounted(async () => {
      try {
        activeIpcRenderListener();
        remote.os.call("platform").then(async (platform) => {
          if (platform === "win32") {
            const release = await getWindowsRelease();
            if (release !== "win11") {
              document.documentElement.classList.add("window-frame");
            }
          }
        });
        if (inBrowser) {
          store.render.state.setup = false;
          Modal.warning({
            content: "\u4E0B\u8F7D\u684C\u9762\u7248\u8F6F\u4EF6\u624D\u80FD\u4F53\u9A8C\u5168\u90E8\u529F\u80FD\uFF01",
            title: "\u8B66\u544A",
            simple: true,
            hideCancel: false,
            okText: "\u524D\u5F80\u5B98\u7F51\u4E0B\u8F7D",
            onOk() {
              window.open("https://docs.ocsjs.com/docs/\u8D44\u6E90\u4E0B\u8F7D/app-downloads", "_blank");
            }
          });
        }
        remote.win.call("setTitle", `学不通 - ${router.resolve(currentRoute.value).meta.title}`);
        remote.logger.call("info", "render store init");
        setAutoLaunch();
        setAlwaysOnTop();
        changeTheme().catch(console.error);
        if (store.render.state.first) {
          about().catch(console.error);
        }
        onResize();
        window.addEventListener("resize", onResize);
        fetchRemoteNotify(false).catch(console.error);
        fetchRemoteLangs().catch(console.error);
        remote.methods.call("statisticFolderSize", store.paths.userDataDirsFolder).then((totalSize) => {
          var _a2;
          if (totalSize > 1024 * 1024 * 1024 * ((_a2 = store.render.setting.browser.cachesSizeWarningPoint) != null ? _a2 : 10)) {
            showClearBrowserCachesModal(totalSize);
          }
        });
        watch(
          () => cloneDeep_1(store.render.setting.theme),
          (cur, prev) => {
            if (cur.dark) {
              document.body.setAttribute("arco-theme", "dark");
            } else {
              document.body.removeAttribute("arco-theme");
            }
          }
        );
        watch(
          [
            () => store.render.setting.ocs.openSync,
            () => store.render.setting.launchOptions.executablePath,
            () => store.render.setting.browser.enableDialog,
            () => store.render.setting.browser.forceUpdateScript
          ],
          async () => {
            await saveStoreToLocal(store).catch(console.error);
          }
        );
        watch(
          [() => store.render],
          debounce_1(() => {
            saveStoreToLocal(store).catch(console.error);
          }, 1e3),
          { deep: true }
        );
        watch(() => store.window.autoLaunch, setAutoLaunch);
        watch(() => store.window.alwaysOnTop, setAlwaysOnTop);
        watch([() => store.app, () => store.window],debounce_1(()=>saveStoreToLocal(store).catch(console.error),200),{deep:true});
        window.onresize = () => {
          store.render.state.height = document.documentElement.clientHeight;
        };
      } catch (e) {
        console.error(e);
      }
    });
    ipcRenderer2.on("close", async () => {
      if(window.__fusionClosing)return;
      window.__fusionClosing=true;
      let savingMessage;
      try{
      await window.FusionWorkspace?.flushCredentials?.();
      if(window.xingchanBridge&&!(await window.xingchanBridge.confirmClose({browserCount:processes.filter(p=>p.status!=='closed').length})))return;
      console.log("\u5173\u95ED\u6D4F\u89C8\u5668\u4E2D...");
      const res = await closeAllBrowser(!!window.xingchanBridge);
      if (res === false) {
        console.log("\u6709\u6D4F\u89C8\u5668\u62D2\u7EDD\u5173\u95ED\uFF0C\u53D6\u6D88\u9000\u51FA");
        return;
      }
      console.log("\u4FDD\u5B58\u6570\u636E\u4E2D...");
      savingMessage = Modal.info({ content: "\u6B63\u5728\u4FDD\u5B58\u6570\u636E...", closable: false, maskClosable: false, footer: false });
      await saveStoreToLocal(store);
      savingMessage.close();
      savingMessage=null;
      console.log("\u6570\u636E\u5DF2\u4FDD\u5B58");
      if(window.xingchanBridge)await window.xingchanBridge.finishClose();else remote.app.call("exit",0);
      }catch(error){if(error?.message!=='已取消重复账号配置'){console.error(error);Modal.error({title:'暂未关闭',content:'保存配置或关闭账号未完成，请稍后重试。'});}}finally{savingMessage?.close();window.__fusionClosing=false;}
    });
    let pendingStoreWrite=Promise.resolve();
    window.__fusionSaveStore=()=>saveStoreToLocal(store);
    function clickMenu(route) {
      router.push(route.path);
      remote.win.call("setTitle", `学不通 - ${route.meta.title}`);
    }
    function saveStoreToLocal(value) {
      if(window.__fusionImportInProgress)return Promise.resolve();
      const snapshot=JSON.parse(JSON.stringify(value));
      const operation=pendingStoreWrite.catch(()=>{}).then(()=>writeStoreToLocal(snapshot));pendingStoreWrite=operation;return operation;
    }
    async function writeStoreToLocal(_store2) {
      if(window.__fusionImportInProgress)return;
      try {
        if (inBrowser) {
          localStorage.setItem("ocs-app-store", JSON.stringify(_store2));
        } else {
          if (remote.methods.callSync("isEncryptionAvailable") && _store2.app.data_encryption) {
            const resolved_store = JSON.parse(JSON.stringify(_store2));
            Reflect.set(
              resolved_store,
              "render",
              await remote.methods.call("encryptString", JSON.stringify(resolved_store.render))
            );
            await remote["electron-store"].set("store", JSON.parse(JSON.stringify(resolved_store)));
          } else {
            await remote["electron-store"].set("store", JSON.parse(JSON.stringify(_store2)));
          }
        }
      } catch (e) {
        console.error(e);
        throw e;
      }
    }
    function onResize() {
      const isInMobile = document.documentElement.clientWidth < 1200;
      store.render.state.mini = isInMobile;
      store.render.state.responsive = isInMobile ? "mini" : "small";
      if (document.documentElement.clientWidth < 800) {
        store.render.state.mini = true;
      } else {
        store.render.state.mini = false;
      }
    }
    return (_ctx, _cache) => {
      const _component_router_view = resolveComponent("router-view");
      const _component_a_modal = resolveComponent("a-modal");
      const _component_a_divider = resolveComponent("a-divider");
      const _component_a_drawer = resolveComponent("a-drawer");
      const _component_a_config_provider = resolveComponent("a-config-provider");
      return openBlock(), createBlock(_component_a_config_provider, { locale: unref(lang$1) }, {
        default: withCtx(() => [
          createVNode(CommonEditActionDropdown, {
            trigger: "contextMenu",
            "align-point": "",
            position: "bl",
            style: { display: "block" }
          }, {
            default: withCtx(() => {
              var _a2;
              return [
                createBaseVNode("div", _hoisted_1$1, [
                  createBaseVNode("div", _hoisted_2$1, [
                    createBaseVNode("div", _hoisted_3$1, [
                      createBaseVNode("div", _hoisted_4$1, [
                        createVNode(Title, { id: "title" })
                      ]),
                      createBaseVNode("div", _hoisted_5$1, [
                        createBaseVNode("div", {
                          style: normalizeStyle({ width: state.sideBarWidth + "px" }),
                          class: "h-100"
                        }, [
                          createBaseVNode("div", _hoisted_6$1, [
                            unref(routes).find((r) => r.name === "index") ? (openBlock(), createElementBlock("div", {
                              key: 0,
                              style: normalizeStyle({
                                width: state.sideBarWidth + "px",
                                flex: `0 0 ${state.sideBarWidth}px`
                              }),
                              class: "sider-items"
                            }, [
                              (openBlock(true), createElementBlock(Fragment, null, renderList((_a2 = unref(routes).find((r) => r.name === "index")) == null ? void 0 : _a2.children, (item, index) => {
                                return openBlock(), createElementBlock("div", {
                                  key: index,
                                  class: normalizeClass(["sider-item", { active: item.name === unref(currentRoute).name }]),
                                  onClick: ($event) => clickMenu(item)
                                }, [
                                  (openBlock(), createBlock(resolveDynamicComponent(unref(store).render.setting.showSideBarText ? "div" : unref(Tooltip)), {
                                    style: { "height": "28px" },
                                    content: item.meta.title,
                                    position: "right"
                                  }, {
                                    default: withCtx(() => [
                                      createVNode(Icon, {
                                        class: "icon",
                                        type: item.meta.icon,
                                        theme: "outlined"
                                      }, null, 8, ["type"])
                                    ]),
                                    _: 2
                                  }, 1032, ["content"])),
                                  unref(store).render.setting.showSideBarText ? (openBlock(), createElementBlock("div", _hoisted_8$1, toDisplayString(item.meta.title), 1)) : createCommentVNode("", true)
                                ], 10, _hoisted_7$1);
                              }), 128))
                            ], 4)) : createCommentVNode("", true),
                            createBaseVNode("div", _hoisted_9$1, toDisplayString(version.value), 1)
                          ])
                        ], 4),
                        createBaseVNode("div", {
                          style: normalizeStyle({ width: `calc(100% - ${state.sideBarWidth}px)` })
                        }, [
                          createVNode(_component_router_view, null, {
                            default: withCtx(({ Component }) => [
                              (openBlock(), createBlock(KeepAlive, null, [
                                (openBlock(), createBlock(resolveDynamicComponent(Component)))
                              ], 1024))
                            ]),
                            _: 1
                          })
                        ], 4)
                      ])
                    ])
                  ])
                ]),
                unref(currentBrowser) ? (openBlock(), createElementBlock(Fragment, { key: unref(currentBrowser).uid }, [
                  unref(store).render.state.mini ? (openBlock(), createBlock(_component_a_modal, {
                    key: 0,
                    title: "账号操作",
                    visible: !!unref(currentBrowser),
                    width: 600,
                    footer: false,
                    fullscreen: "",
                    onCancel: _cache[0] || (_cache[0] = ($event) => unref(store).render.browser.currentBrowserUid = "")
                  }, {
                    title: withCtx(() => [
                      createVNode(_sfc_main$2, { browser: unref(currentBrowser) }, null, 8, ["browser"])
                    ]),
                    default: withCtx(() => [
                      createVNode(BrowserPanel, { browser: unref(currentBrowser) }, null, 8, ["browser"])
                    ]),
                    _: 1
                  }, 8, ["visible"])) : (openBlock(), createBlock(_component_a_drawer, {
                    key: 1,
                    id: "browser-panel",
                    "popup-container": "#component",
                    closable: false,
                    visible: !!unref(currentBrowser),
                    width: 600,
                    footer: false,
                    header: false,
                    onCancel: _cache[1] || (_cache[1] = ($event) => unref(store).render.browser.currentBrowserUid = "")
                  }, {
                    default: withCtx(() => [
                      createVNode(_sfc_main$2, { browser: unref(currentBrowser) }, null, 8, ["browser"]),
                      createVNode(_component_a_divider, { class: "mt-2 mb-1" }),
                      createVNode(BrowserPanel, { browser: unref(currentBrowser) }, null, 8, ["browser"])
                    ]),
                    _: 1
                  }, 8, ["visible"]))
                ], 64)) : createCommentVNode("", true),
                unref(store).render.state.setup ? (openBlock(), createBlock(Setup, {
                  key: 1,
                  visible: unref(store).render.state.setup,
                  "onUpdate:visible": _cache[2] || (_cache[2] = ($event) => unref(store).render.state.setup = $event)
                }, null, 8, ["visible"])) : createCommentVNode("", true)
              ];
            }),
            _: 1
          })
        ]),
        _: 1
      }, 8, ["locale"]);
    };
  }
});
const index_vue_vue_type_style_index_0_lang = "";
const _hoisted_1 = { class: "bookmarks" };
const _hoisted_2 = { class: "bookmarks-blockquote browser-info text-secondary mb-3 mt-3" };
const _hoisted_3 = { style: { "display": "flex", "align-items": "center" } };
const _hoisted_4 = { id: "notes" };
const _hoisted_5 = { class: "bookmark-card-body" };
const _hoisted_6 = ["href"];
const _hoisted_7 = { class: "icon col-12" };
const _hoisted_8 = ["src"];
const _hoisted_9 = { class: "col-12 mt-1 text-black text-decoration-underline" };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "bookmarks",
  setup(__props) {
    const bookmarks2 = ref([]);
    const state = reactive({
      loading: false,
      warn: false,
      tips: [""]
    });
    window.setBookmarkLoadingState = (_state) => {
      Object.assign(state, _state);
    };
    onMounted(async () => {
      const infos = await OCSApi.getInfos();
      document.title = "学不通 - 导航页";
      for (let i = 0; i < infos.bookmark.length; i++) {
        const bookmark = infos.bookmark[i];
        bookmark.values.forEach(async (_, j) => {
          const site = reactive(bookmark.values[j]);
          bookmarks2.value[i] = bookmarks2.value[i] || { group: "", values: [] };
          bookmarks2.value[i].group = bookmark.group;
          bookmarks2.value[i].values[j] = site;
        });
      }
      setTimeout(() => {
        var _a2;
        const nameEl = document.querySelector("#browser-name");
        const tagsEl = document.querySelector("#browser-tags");
        const notesEl = document.querySelector("#browser-notes");
        const dataTextContent = ((_a2 = document.querySelector("#data-slot")) == null ? void 0 : _a2.textContent) || "";
        console.log("data-slot", dataTextContent);
        if (nameEl && tagsEl && notesEl && dataTextContent) {
          const { name = "", tags = [], notes = "" } = JSON.parse(dataTextContent || "{}");
          nameEl.innerHTML = name || "\u672A\u77E5\u540D\u79F0";
          tagsEl.innerHTML = tags.map(
            (t) => `<span style="background-color: ${t.color};" class="browser-tag">${t.name}</span>`
          );
          notesEl.innerHTML = notes || "\u672A\u77E5";
        }
      }, 500);
    });
    function openInApp() {
      var _a2;
      const { uid } = JSON.parse(((_a2 = document.querySelector("#data-slot")) == null ? void 0 : _a2.textContent) || "{}");
      fetch("http://localhost:15319/api/bookmark/show-browser-in-app?uid=" + uid);
    }
    return (_ctx, _cache) => {
      const _component_icon_loading = resolveComponent("icon-loading");
      const _component_a_button = resolveComponent("a-button");
      const _component_a_space = resolveComponent("a-space");
      const _component_a_tooltip = resolveComponent("a-tooltip");
      const _component_a_spin = resolveComponent("a-spin");
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createVNode(_component_a_spin, {
          class: "w-100 h-100 p-3",
          loading: state.loading
        }, {
          element: withCtx(() => [
            createBaseVNode("div", null, [
              createVNode(_component_icon_loading)
            ]),
            (openBlock(true), createElementBlock(Fragment, null, renderList(state.tips, (tip, index) => {
              return openBlock(), createElementBlock("div", {
                key: index,
                style: { "font-size": "12px" }
              }, toDisplayString(tip), 1);
            }), 128))
          ]),
          default: withCtx(() => [
            _cache[7] || (_cache[7] = createBaseVNode("div", {
              id: "data-slot",
              style: { "display": "none" }
            }, null, -1)),
            createBaseVNode("div", _hoisted_2, [
              createBaseVNode("div", _hoisted_3, [
                _cache[2] || (_cache[2] = createTextVNode(" 当前账号： ", -1)),
                createVNode(_component_a_space, { size: "large" }, {
                  default: withCtx(() => [
                    _cache[1] || (_cache[1] = createBaseVNode("span", { id: "browser-name" }, "...", -1)),
                    createVNode(_component_a_button, {
                      size: "mini",
                      type: "outline",
                      onClick: openInApp
                    }, {
                      default: withCtx(() => [..._cache[0] || (_cache[0] = [
                        createTextVNode(" \u5728\u8F6F\u4EF6\u4E2D\u663E\u793A ", -1)
                      ])]),
                      _: 1
                    })
                  ]),
                  _: 1
                })
              ]),
              _cache[3] || (_cache[3] = createBaseVNode("div", null, [
                createTextVNode("\u6807\u7B7E\uFF1A"),
                createBaseVNode("span", { id: "browser-tags" }, "...")
              ], -1)),
              _cache[4] || (_cache[4] = createBaseVNode("div", null, [
                createTextVNode("\u5907\u6CE8\uFF1A"),
                createBaseVNode("span", { id: "browser-notes" }, "...")
              ], -1))
            ]),
            createBaseVNode("div", _hoisted_4, [
              _cache[5] || (_cache[5] = createBaseVNode("div", { class: "bookmarks-blockquote text-secondary mb-3" }, [
                createBaseVNode("div", null, "\u8FDB\u5165\u6D4F\u89C8\u5668\u5E76\u7B49\u5F85\u521D\u59CB\u5316\u540E\uFF0C\u5373\u53EF\u4F7F\u7528\u5B89\u88C5\u7684\u6D4F\u89C8\u5668\u811A\u672C\u7BA1\u7406\u62D3\u5C55\uFF0C\u8FDB\u884C\u811A\u672C\u7684\u8FD0\u884C\u3002"),
                createBaseVNode("div", null, " \u5982\u679C\u60A8\u4F7F\u7528\u7684\u662F \u201COCS \u7F51\u8BFE\u52A9\u624B\u201D\uFF0C\u8BF7\u6253\u5F00\u4EE5\u4E0B\u4EFB\u610F\u4E00\u4E2A\u7F51\u8BFE\u5E73\u53F0\u5373\u53EF\uFF0C\u4F1A\u51FA\u73B0\u811A\u672C\u60AC\u6D6E\u7A97\uFF0C\u5E76\u6709\u5BF9\u5E94\u7684\u4F7F\u7528\u6559\u7A0B\u3002 ")
              ], -1)),
              _cache[6] || (_cache[6] = createBaseVNode("hr", null, null, -1)),
              createBaseVNode("div", {
                class: normalizeClass(["bookmarks-blockquote text-secondary mb-3", { warn: state.warn }])
              }, [
                (openBlock(true), createElementBlock(Fragment, null, renderList(state.tips, (tip, index) => {
                  return openBlock(), createElementBlock("div", { key: index }, " \u5F53\u524D\u72B6\u6001\uFF1A" + toDisplayString(tip), 1);
                }), 128))
              ], 2)
            ]),
            _cache[8] || (_cache[8] = createBaseVNode("h1", null, "学不通 导航页", -1)),
            (openBlock(true), createElementBlock(Fragment, null, renderList(bookmarks2.value, (item) => {
              return openBlock(), createElementBlock(Fragment, {
                key: item == null ? void 0 : item.group
              }, [
                !!item ? (openBlock(), createBlock(unref(Card), {
                  key: 0,
                  class: "bookmarks-card rounded shadow-sm p-0",
                  bordered: false,
                  title: item.group
                }, {
                  default: withCtx(() => [
                    createBaseVNode("div", _hoisted_5, [
                      (openBlock(true), createElementBlock(Fragment, null, renderList(item.values, (bookmark) => {
                        return openBlock(), createElementBlock("div", {
                          key: bookmark == null ? void 0 : bookmark.name,
                          class: "bookmark"
                        }, [
                          !!bookmark ? (openBlock(), createElementBlock("a", {
                            key: 0,
                            href: bookmark.url,
                            target: "_blank"
                          }, [
                            createVNode(_component_a_tooltip, { "background-color": "#6c6c6ccf" }, {
                              content: withCtx(() => [
                                createBaseVNode("div", null, toDisplayString(bookmark.description || "\u6682\u65E0\u63CF\u8FF0"), 1)
                              ]),
                              default: withCtx(() => [
                                createBaseVNode("div", _hoisted_7, [
                                  createBaseVNode("img", {
                                    src: bookmark.icon
                                  }, null, 8, _hoisted_8)
                                ])
                              ]),
                              _: 2
                            }, 1024),
                            createBaseVNode("div", _hoisted_9, toDisplayString(bookmark.name), 1)
                          ], 8, _hoisted_6)) : createCommentVNode("", true)
                        ]);
                      }), 128))
                    ])
                  ]),
                  _: 2
                }, 1032, ["title"])) : createCommentVNode("", true)
              ], 64);
            }), 128))
          ]),
          _: 1
        }, 8, ["loading"])
      ]);
    };
  }
});
const bookmarks_vue_vue_type_style_index_0_lang = "";
const bookmarks_vue_vue_type_style_index_1_scoped_393d8dad_lang = "";
const bookmarks = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-393d8dad"]]);
const config = reactive({
  routes: [
    {
      name: "index",
      path: "/",
      redirect: "/browsers",
      component: shallowRef(_sfc_main$1),
      children: [
        {
          name: "browsers",
          path: "browsers",
          component: () => __vitePreload(() => import("./index.ce0090a0.js"), true ? ["./index.ce0090a0.js","./@vue.10d2ded6.js","./lodash.4ddd9dd3.js","./@babel.dac5e1c0.js","./global.dfc622c4.js","./@arco-design.3c56df6b.js","./resize-observer-polyfill.375322e1.js","./compute-scroll-into-view.079a5c71.js","./b-tween.3dc4e04f.js","./dayjs.a79bd2ae.js","./number-precision.a111f450.js","./scroll-into-view-if-needed.10a505ff.js","./b-validate.edd52b51.js","./@arco-design.b69bd8c7.css","./EntityOperator.vue_vue_type_script_setup_true_lang.26d0c230.js","./vue-router.1b6385d9.js","./video.30def082.css","./markdown-it.a39105cb.js","./entities.9efde8b5.js","./uc.micro.428571ea.js","./mdurl.b48c0e08.js","./linkify-it.91515adc.js","./punycode.768648d9.js","./markdown-it-emoji.14324b8a.js","./markdown-it-container.9b7103eb.js","./axios.1e37c3a4.js","./events.7cc16d47.js","./colorpicker-v3.2c723672.js","./colorpicker-v3.a51bb9bd.css","./xterm.9fe37c82.js","./xterm.832f3f2c.css","./xterm-addon-fit.1029e58f.js","./index.15f79ec1.css","./material-icons.570e8a71.css"] : void 0, import.meta.url),
          meta: {
            icon: "view_list",
            title: "账号列表"
          }
        },
        {
          name: "user-scripts",
          path: "user-scripts",
          component: () => __vitePreload(() => import("./index.a5f6afe1.js"), true ? ["./index.a5f6afe1.js","./@vue.10d2ded6.js","./@arco-design.3c56df6b.js","./resize-observer-polyfill.375322e1.js","./compute-scroll-into-view.079a5c71.js","./b-tween.3dc4e04f.js","./dayjs.a79bd2ae.js","./@babel.dac5e1c0.js","./number-precision.a111f450.js","./scroll-into-view-if-needed.10a505ff.js","./b-validate.edd52b51.js","./@arco-design.b69bd8c7.css","./vue-router.1b6385d9.js","./lodash.4ddd9dd3.js","./global.dfc622c4.js","./video.30def082.css","./markdown-it.a39105cb.js","./entities.9efde8b5.js","./uc.micro.428571ea.js","./mdurl.b48c0e08.js","./linkify-it.91515adc.js","./punycode.768648d9.js","./markdown-it-emoji.14324b8a.js","./markdown-it-container.9b7103eb.js","./axios.1e37c3a4.js","./events.7cc16d47.js","./colorpicker-v3.2c723672.js","./colorpicker-v3.a51bb9bd.css","./xterm.9fe37c82.js","./xterm.832f3f2c.css","./xterm-addon-fit.1029e58f.js","./index.b536dc35.css","./material-icons.570e8a71.css"] : void 0, import.meta.url),
          meta: {
            icon: "code",
            title: "\u811A\u672C\u5217\u8868"
          }
        },
        {
          name: "resources",
          path: "resources",
          component: () => __vitePreload(() => import("./index.0363bfa5.js"), true ? ["./index.0363bfa5.js","./@arco-design.3c56df6b.js","./@vue.10d2ded6.js","./resize-observer-polyfill.375322e1.js","./compute-scroll-into-view.079a5c71.js","./b-tween.3dc4e04f.js","./dayjs.a79bd2ae.js","./@babel.dac5e1c0.js","./number-precision.a111f450.js","./scroll-into-view-if-needed.10a505ff.js","./b-validate.edd52b51.js","./@arco-design.b69bd8c7.css","./vue-router.1b6385d9.js","./lodash.4ddd9dd3.js","./global.dfc622c4.js","./video.30def082.css","./markdown-it.a39105cb.js","./entities.9efde8b5.js","./uc.micro.428571ea.js","./mdurl.b48c0e08.js","./linkify-it.91515adc.js","./punycode.768648d9.js","./markdown-it-emoji.14324b8a.js","./markdown-it-container.9b7103eb.js","./axios.1e37c3a4.js","./events.7cc16d47.js","./colorpicker-v3.2c723672.js","./colorpicker-v3.a51bb9bd.css","./xterm.9fe37c82.js","./xterm.832f3f2c.css","./xterm-addon-fit.1029e58f.js","./material-icons.570e8a71.css"] : void 0, import.meta.url),
          meta: {
            icon: "widgets",
            title: "\u5E94\u7528\u4E2D\u5FC3"
          }
        },
        {
          name: "dashboard",
          path: "dashboard",
          component: () => __vitePreload(() => import("./index.9cae71c6.js"), true ? ["./index.9cae71c6.js","./@vue.10d2ded6.js","./EntityOperator.vue_vue_type_script_setup_true_lang.26d0c230.js","./@arco-design.3c56df6b.js","./resize-observer-polyfill.375322e1.js","./compute-scroll-into-view.079a5c71.js","./b-tween.3dc4e04f.js","./dayjs.a79bd2ae.js","./@babel.dac5e1c0.js","./number-precision.a111f450.js","./scroll-into-view-if-needed.10a505ff.js","./b-validate.edd52b51.js","./@arco-design.b69bd8c7.css","./vue-router.1b6385d9.js","./lodash.4ddd9dd3.js","./global.dfc622c4.js","./video.30def082.css","./markdown-it.a39105cb.js","./entities.9efde8b5.js","./uc.micro.428571ea.js","./mdurl.b48c0e08.js","./linkify-it.91515adc.js","./punycode.768648d9.js","./markdown-it-emoji.14324b8a.js","./markdown-it-container.9b7103eb.js","./axios.1e37c3a4.js","./events.7cc16d47.js","./colorpicker-v3.2c723672.js","./colorpicker-v3.a51bb9bd.css","./xterm.9fe37c82.js","./xterm.832f3f2c.css","./xterm-addon-fit.1029e58f.js","./index.70088a0a.css","./material-icons.570e8a71.css"] : void 0, import.meta.url),
          meta: {
            icon: "image",
            title: "\u76D1\u63A7\u5217\u8868"
          }
        },
        {
          name: "setting",
          path: "setting",
          component: () => __vitePreload(() => import("./index.610119b9.js"), true ? ["./index.610119b9.js","./@vue.10d2ded6.js","./@arco-design.3c56df6b.js","./resize-observer-polyfill.375322e1.js","./compute-scroll-into-view.079a5c71.js","./b-tween.3dc4e04f.js","./dayjs.a79bd2ae.js","./@babel.dac5e1c0.js","./number-precision.a111f450.js","./scroll-into-view-if-needed.10a505ff.js","./b-validate.edd52b51.js","./@arco-design.b69bd8c7.css","./easy-us.d8908933.js","./events.7cc16d47.js","./lodash.4ddd9dd3.js","./vue-router.1b6385d9.js","./global.dfc622c4.js","./video.30def082.css","./markdown-it.a39105cb.js","./entities.9efde8b5.js","./uc.micro.428571ea.js","./mdurl.b48c0e08.js","./linkify-it.91515adc.js","./punycode.768648d9.js","./markdown-it-emoji.14324b8a.js","./markdown-it-container.9b7103eb.js","./axios.1e37c3a4.js","./colorpicker-v3.2c723672.js","./colorpicker-v3.a51bb9bd.css","./xterm.9fe37c82.js","./xterm.832f3f2c.css","./xterm-addon-fit.1029e58f.js","./index.a7b17cd1.css","./material-icons.570e8a71.css"] : void 0, import.meta.url),
          meta: {
            icon: "settings",
            title: "\u8F6F\u4EF6\u8BBE\u7F6E"
          }
        }
      ]
    },
    {
      name: "bookmarks",
      path: "/bookmarks",
      component: shallowRef(bookmarks),
      meta: {
        icon: "view_list",
        title: "\u4E66\u7B7E\u5217\u8868",
        hideInMenu: true
      }
    }
  ],
  themes: {
    dark: false
  },
  scriptSearchEngines: [
    (() => {
      const transformToCommonByInfo = (script, info) => {
        var _a2;
        script.version = info.script.version;
        script.code_url = `https://scriptcat.org/scripts/code/${info.script.script_id}/${info.name}.user.js`;
        script.url = `https://scriptcat.org/script-show-page/${info.script.script_id}`;
        script.authors = [
          {
            url: `https://scriptcat.org/users/${info.user_id}`,
            name: info.username,
            avatar: info.avatar ? `https://scriptcat.org${info.avatar}` : void 0
          }
        ];
        script.description = info.description;
        script.name = info.name;
        script.ratings = info.score / ((_a2 = info.score_num) != null ? _a2 : 1) / 10;
        script.create_time = info.createtime * 1e3;
        script.update_time = info.updatetime * 1e3;
        script.daily_installs = info.today_install;
        script.total_installs = info.total_install;
        return script;
      };
      return {
        type: "scriptcat",
        name: "ScriptCat - \u811A\u672C\u732B",
        homepage: "https://scriptcat.org",
        search: async (keyword, page2, size2) => {
          const data = await remote.methods.call(
            "get",
            "https://scriptcat.org/api/v2/scripts?" + new URLSearchParams({
              count: size2.toString(),
              page: page2 <= 0 ? "1" : page2.toString(),
              keyword
            })
          );
          let list = data.data.list;
          list = list.sort((a, b) => {
            return b.today_install - a.today_install;
          });
          return list.map((item) => {
            return {
              ...transformToCommonByInfo({}, item),
              id: item.script.script_id,
              version: item.script.version
            };
          });
        },
        infoGetter: async (script) => {
          return (await remote.methods.call("get", `https://scriptcat.org/api/v2/scripts/${script.id}`)).data;
        },
        transformToCommonByInfo,
        versionProvider: async (script) => {
          const data = await remote.methods.call("get", `https://scriptcat.org/api/v2/scripts/${script.id}/versions`);
          const list = data.data.list;
          return list.map((item) => {
            var _a2;
            return {
              version: item.version,
              url: script.url,
              code_url: `https://scriptcat.org/scripts/code/${item.script_id}/${(_a2 = script.info) == null ? void 0 : _a2.name}.user.js?version=${item.version}`,
              create_time: item.createtime * 1e3
            };
          });
        }
      };
    })(),
    (() => {
      const transformToCommonByInfo = (script, info) => {
        script.version = info.version;
        script.code_url = info.code_url;
        script.ratings = (info.good_ratings + info.ok_ratings + (info.good_ratings + info.ok_ratings + info.bad_ratings) * 0.5) * 10;
        script.url = info.url;
        script.authors = info.users;
        script.license = info.license;
        script.description = info.description;
        script.name = info.name;
        script.create_time = new Date(info.created_at).getTime();
        script.update_time = new Date(info.code_updated_at).getTime();
        script.daily_installs = info.daily_installs;
        script.total_installs = info.total_installs;
        return script;
      };
      return {
        type: "greasyfork",
        name: "GreasyFork-\u6CB9\u53C9",
        homepage: "https://greasyfork.org",
        search: async (keyword, page2, size2) => {
          const data = await remote.methods.call(
            "get",
            "https://greasyfork.org/zh-CN/scripts.json?" + new URLSearchParams({
              q: keyword,
              page: page2 <= 0 ? "1" : page2.toString()
            }),
            {}
          );
          let list = data;
          list = list.sort((a, b) => {
            return b.daily_installs - a.daily_installs;
          });
          return list.map((item) => {
            return {
              ...transformToCommonByInfo({}, item),
              id: item.id,
              version: item.version
            };
          });
        },
        async infoGetter(script) {
          return (await remote.methods.call("get", `https://greasyfork.org/zh-CN/scripts/${script.id}.json`)).data;
        },
        transformToCommonByInfo,
        versionProvider: async (script) => {
          const data = await remote.methods.call(
            "get",
            `https://greasyfork.org/zh-CN/scripts/${script.id}/versions.json`
          );
          return data.map((item) => ({
            version: item.version,
            url: item.url,
            code_url: item.code_url,
            create_time: new Date(item.created_at).getTime()
          }));
        }
      };
    })()
  ]
});
const routes = config.routes;
const router = createRouter({
  history: createWebHashHistory(),
  routes
});
router.beforeEach(() => {
  return true;
});
window.addEventListener("error", function(e) {
  console.error(e);
  if (e instanceof ErrorEvent) {
    if (errorFilter((e == null ? void 0 : e.message) || String(e) || "")) {
      return;
    }
  }
  remote.logger.call("error", "\u672A\u77E5\u7684\u9519\u8BEF", e);
  notify("\u672A\u77E5\u7684\u9519\u8BEF", e, "render-error", {
    type: "error",
    copy: true
  });
});
window.addEventListener("unhandledrejection", function(e) {
  e.promise.catch((e2) => {
    console.error(e2);
    try {
      if (errorFilter((e2 == null ? void 0 : e2.message) || String(e2) || "")) {
        return;
      }
      remote.logger.call("error", "\u672A\u6355\u83B7\u7684\u5F02\u6B65\u9519\u8BEF", (e2 == null ? void 0 : e2.stack) || (e2 == null ? void 0 : e2.message) || e2 || "");
      notify("\u672A\u6355\u83B7\u7684\u5F02\u6B65\u9519\u8BEF", e2, "render-error", {
        type: "error",
        copy: true
      });
    } catch (e3) {
      console.error(e3);
    }
  });
});
function errorFilter(str) {
  if (str.includes("ResizeObserver loop")) {
    return true;
  }
  if (str.includes("CrashpadMetrics")) {
    return true;
  }
}
createApp(App).use(router).use(ArcoVue).use(ArcoVueIcon).component("IconFont", Icon$1.addFromIconFontCn({ src: "js/acro.font.js" })).directive("focus", {
  mounted(el) {
    el.focus();
  }
}).mount("#app");
function watchFusionTags(callback){return watch(()=>window.FusionAccountTags.collect(store.render.browser.root),callback,{deep:true});}
export {
  watchFusionTags,
  setFusionBrowserStatus,
  setFusionBrowserActions,
  watchFusionProcesses,
  readFusionNativeCredentials,
  writeFusionNativeCredentials,
  watchFusionCredentials,
  Browser as B,
  CommonSelector as C,
  Entity as E,
  Folder as F,
  Icon as I,
  PlaywrightScriptSelector as P,
  Setup as S,
  Tags as T,
  _export_sfc as _,
  newBrowser as a,
  root as b,
  currentFolder as c,
  currentSearchedEntities as d,
  BrowserOperators as e,
  Process as f,
  Environment as g,
  resetSearch as h,
  inBrowser as i,
  currentEntities as j,
  about as k,
  lang as l,
  config as m,
  newFolder as n,
  openScriptSource as o,
  addScriptFromFile as p,
  addScriptFromUrl as q,
  remote as r,
  store as s,
  getRemoteInfos as t,
  resourceLoader$1 as u,
  child_process as v,
  electron as w,
  processes as x,
  forceClearBrowserCache as y,
  changeTheme as z
};
