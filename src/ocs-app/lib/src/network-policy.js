'use strict';

// The fusion app always connects directly. This module changes this process and
// its children only; Windows Internet Options and other applications stay intact.
const PROXY_ENV = /^(?:(?:http|https|all|ftp|ws|wss)_proxy|no_proxy|npm_config_(?:proxy|https_proxy|noproxy)|global_agent_(?:http_proxy|https_proxy|no_proxy)|node_use_env_proxy)$/i;
const configuredAxios = new WeakSet();

function directEnvironment(source = process.env) {
    const env = Object.fromEntries(Object.entries(source).filter(([key]) => !PROXY_ENV.test(key)));
    env.NO_PROXY = '*';
    env.no_proxy = '*';
    env.NODE_USE_ENV_PROXY = '0';
    return env;
}

function installNodeDirect(axios) {
    for (const key of Object.keys(process.env)) if (PROXY_ENV.test(key)) delete process.env[key];
    Object.assign(process.env, directEnvironment(process.env));
    if (axios && !configuredAxios.has(axios)) {
        axios.defaults.proxy = false;
        // Config imported from an earlier OCS version must not re-enable a proxy.
        axios.interceptors.request.use(config => { config.proxy = false; return config; });
        configuredAxios.add(axios);
    }
}

function directBrowserArguments(args = []) {
    const result = [];
    for (let index = 0; index < args.length; index++) {
        const argument = String(args[index]);
        if (/^--(?:proxy-server|proxy-pac-url|proxy-bypass-list)(?:=|$)/i.test(argument)) {
            if (!argument.includes('=') && args[index + 1] && !String(args[index + 1]).startsWith('--')) index++;
        } else if (!/^--(?:proxy-auto-detect|no-proxy-server)(?:=|$)/i.test(argument)) result.push(argument);
    }
    return [...result, '--no-proxy-server'];
}

function installElectronDirect(app) {
    for (const name of ['proxy-server', 'proxy-pac-url', 'proxy-auto-detect']) app.commandLine.removeSwitch(name);
    app.commandLine.appendSwitch('no-proxy-server');
    const prepared = new WeakMap();
    const prepare = session => {
        if (!prepared.has(session)) {
            const job = session.setProxy({mode: 'direct'}).then(() => session.closeAllConnections());
            prepared.set(session, job);
        }
        return prepared.get(session);
    };
    app.on('session-created', session => { prepare(session).catch(() => console.error('融合版直连网络初始化失败')); });
    return {prepare};
}

module.exports = {directEnvironment, installNodeDirect, directBrowserArguments, installElectronDirect};
