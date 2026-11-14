"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaywrightScript = exports.ConfigsRequiredAutomationScript = exports.AutomationScript = exports.CollectorScript = exports.Script = void 0;
const interface_1 = require("./interface");
class Script extends interface_1.TypedEventEmitter {
    constructor(opts) {
        super();
        this.name = opts.name;
        this.run = opts.run;
    }
}
exports.Script = Script;
/** 收集脚本 */
class CollectorScript extends Script {
}
exports.CollectorScript = CollectorScript;
/** 自动化脚本 */
class AutomationScript extends Script {
}
exports.AutomationScript = AutomationScript;
class ConfigsRequiredAutomationScript extends AutomationScript {
    constructor(configs, options) {
        super(options);
        this.name = options.name;
        this.run = options.run;
        this.configs = configs;
    }
}
exports.ConfigsRequiredAutomationScript = ConfigsRequiredAutomationScript;
/** 自动化PW脚本 */
class PlaywrightScript extends ConfigsRequiredAutomationScript {
}
exports.PlaywrightScript = PlaywrightScript;
