'use strict';

// Local feasibility gateway. No extracted Xingchan module is imported or executed.
const http = require('node:http');
const https = require('node:https');
const { randomBytes, randomUUID, createHash, timingSafeEqual } = require('node:crypto');
const { normalizeSearchMethods } = require('../search-methods.cjs');
const { createYanxiV2Adapter } = require('../yanxi/adapter.cjs');
const {createWrapperAdapter}=require('../ocs-wrapper-adapter.cjs');

const HOST = '127.0.0.1';
const MAX_BODY = 256 * 1024;
const MAX_UPSTREAM_BODY = 1024 * 1024;

class GatewayError extends Error {
  constructor(code, status = 502) {
    super(code);
    this.name = 'GatewayError';
    this.code = code;
    this.status = status;
  }
}

function generateLocalToken() {
  return randomBytes(32).toString('base64url');
}

function normalizeText(value) {
  return String(value).normalize('NFKC').replace(/\s+/gu, ' ').trim();
}

function inferType(text) {
  if (/^单选题/u.test(text)) return 'single';
  if (/^多选题/u.test(text)) return 'multiple';
  if (/^填空题/u.test(text)) return 'completion';
  if (/^判断题/u.test(text)) return 'judgement';
  if (/^(?:简答题|问答题|论述题)/u.test(text)) return 'short';
  throw new GatewayError('unsupported_question_type', 400);
}

function parseQuestionPrompt(messages) {
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 32) {
    throw new GatewayError('invalid_messages', 400);
  }
  for (const message of messages) {
    if (!message || !['system', 'user', 'assistant'].includes(message.role) ||
        typeof message.content !== 'string') {
      throw new GatewayError('invalid_message_content', 400);
    }
  }
  const user = messages.findLast(message => message.role === 'user');
  if (!user) throw new GatewayError('missing_user_question', 400);
  const text = user.content.replace(/\r\n?/gu, '\n');
  const match = /^题目类型[:：]([^\n]+)\n题干[:：]([\s\S]+?)\n\s*作答要点[:：]/u.exec(text);
  if (!match) throw new GatewayError('unsupported_xingchan_prompt', 400);
  const type = inferType(match[1].trim());
  let stem = match[2];
  let blankCount = null;
  const blank = /\n填空数量[:：]\s*(\d+)\s*个[^\n]*/u.exec(stem);
  if (blank) {
    blankCount = Number(blank[1]);
    if (blankCount < 1 || blankCount > 100) throw new GatewayError('invalid_blank_count', 400);
    stem = stem.slice(0, blank.index);
  }
  const options = [];
  const optionBoundary = /\n选项[:：]\n/u.exec(stem);
  if (optionBoundary) {
    const block = stem.slice(optionBoundary.index + optionBoundary[0].length).trimEnd();
    stem = stem.slice(0, optionBoundary.index);
    for (const line of block.split('\n')) {
      const option = /^([A-Z])[.．、]\s*(.*)$/u.exec(line);
      if (option) {
        options.push({ label: option[1], text: option[2] });
      } else if (options.length) {
        options[options.length - 1].text += '\n' + line;
      } else if (line.trim()) {
        throw new GatewayError('invalid_option_format', 400);
      }
    }
  }
  if (!stem.trim() || stem.length > 16000 || options.length > 26 ||
      new Set(options.map(option => option.label)).size !== options.length ||
      options.some(option => !option.text.trim())) {
    throw new GatewayError('invalid_question', 400);
  }
  if (['single', 'multiple'].includes(type) && options.length < 2) {
    throw new GatewayError('missing_choice_options', 400);
  }
  return { type, title: stem.trim(), options, blankCount };
}

function normalizeBankAnswer(question, rawAnswer, separator) {
  if (question.type === 'short') {
    const values = Array.isArray(rawAnswer) ? rawAnswer : [rawAnswer];
    if (values.length !== 1 || typeof values[0] !== 'string' ||
        !values[0].trim() || values[0].length > 24000) throw new GatewayError('bank_answer_invalid');
    return values[0].normalize('NFKC').trim();
  }
  let values = Array.isArray(rawAnswer) ? rawAnswer : [rawAnswer];
  if (separator && values.length === 1 && typeof values[0] === 'string') {
    values = values[0].split(separator);
  }
  if (!values.length || values.some(value => !['string', 'boolean', 'number'].includes(typeof value))) {
    throw new GatewayError('bank_answer_invalid');
  }
  values = values.map(value => normalizeText(value));
  if (values.some(value => !value)) throw new GatewayError('bank_answer_invalid');
  if (question.type === 'completion') {
    if (question.blankCount && values.length !== question.blankCount) {
      throw new GatewayError('bank_answer_invalid');
    }
    return values;
  }
  if (question.type === 'judgement') {
    if (values.length !== 1) throw new GatewayError('bank_answer_invalid');
    const lower = values[0].toLowerCase();
    if (['对', '正确', '是', 'true', 't', '√'].includes(lower)) return '对';
    if (['错', '错误', '否', 'false', 'f', '×'].includes(lower)) return '错';
    throw new GatewayError('bank_answer_invalid');
  }
  const labels = question.options.map(option => option.label);
  const letters = [];
  for (const value of values) {
    if (/^[A-Z]+$/u.test(value) && [...value].every(label => labels.includes(label))) {
      letters.push(...value);
      continue;
    }
    const matches = question.options.filter(option => normalizeText(option.text) === value);
    if (matches.length !== 1) throw new GatewayError('bank_answer_invalid');
    letters.push(matches[0].label);
  }
  const unique = [...new Set(letters)].sort();
  if (!unique.length || (question.type === 'single' && unique.length !== 1)) {
    throw new GatewayError('bank_answer_invalid');
  }
  return unique.join('');
}

function validateEndpoint(endpoint) {
  let url;
  try { url = new URL(endpoint); } catch { throw new GatewayError('invalid_upstream_endpoint', 500); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.hash ||
      (url.protocol === 'http:' && url.hostname !== HOST)) {
    throw new GatewayError('insecure_upstream_endpoint', 500);
  }
  // Credentials are separate configuration fields, never embedded in configured URLs.
  if ([...url.searchParams.keys()].some(key => /token|key|secret|auth/iu.test(key))) {
    throw new GatewayError('credentials_in_endpoint', 500);
  }
  return url;
}

function upstreamJson(endpoint, { method = 'GET', headers = {}, body, timeoutMs = 10000,
                                  source = 'upstream' } = {}) {
  return new Promise((resolve, reject) => {
    const transport = endpoint.protocol === 'https:' ? https : http;
    const encoded = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
    let settled = false;
    const done = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else resolve(value);
    };
    const request = transport.request(endpoint, {
      method,
      headers: { Accept: 'application/json', ...headers,
        ...(encoded ? { 'Content-Type': 'application/json', 'Content-Length': encoded.length } : {}) },
      agent: false,
    }, response => {
      const chunks = [];
      let length = 0;
      response.on('data', chunk => {
        length += chunk.length;
        if (length > MAX_UPSTREAM_BODY) {
          response.destroy();
          request.destroy();
          done(new GatewayError(source + '_response_too_large'));
        } else chunks.push(chunk);
      });
      response.on('error', () => done(new GatewayError(source + '_network_error')));
      response.on('end', () => {
        const status = response.statusCode;
        if (status < 200 || status >= 300) {
          const code = status === 401 || status === 403 ? '_authentication_error' :
            status === 402 ? '_balance_error' : status === 429 ? '_rate_limited' : '_http_error';
          return done(new GatewayError(source + code, status === 429 ? 429 : 502));
        }
        try { done(null, JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch { done(new GatewayError(source + '_invalid_json')); }
      });
    });
    request.on('error', () => done(new GatewayError(source + '_network_error')));
    const timer = setTimeout(() => {
      done(new GatewayError(source + '_timeout', 504));
      request.destroy();
    }, timeoutMs);
    if (encoded) request.write(encoded);
    request.end();
  });
}

function valueAt(object, path) {
  let value = object;
  for (const key of path.split('.')) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, key)) return undefined;
    value = value[key];
  }
  return value;
}

function makeBankAdapter(config) {
  const endpoint = validateEndpoint(config.endpoint);
  if (typeof config.token !== 'string' || !config.token) throw new GatewayError('bank_token_missing', 500);
  if(config.driver==='yanxi-post-v2')return createYanxiV2Adapter({token:config.token,wrapper:config.wrapper,timeoutMs:config.timeoutMs});
  if(config.driver==='xingchan-original')return async question=>{
    const result=await upstreamJson(endpoint,{method:'POST',headers:{'X-Token':config.sessionToken},body:{...question,blankCount:question.blankCount??(question.type==='completion'?1:0),key:config.token},source:'original_bank',timeoutMs:Math.min(config.timeoutMs,question.timeoutMs||Infinity)});
    if(result?.kind==='hit'&&Object.hasOwn(result,'answer'))return result;
    if(result?.kind==='miss'&&result.explicitMiss===true)return {kind:'miss'};
    throw new GatewayError('original_bank_query_failed');
  };
  if (config.driver === 'http-contract-v1') {
    return async question => {
      const result = await upstreamJson(new URL(endpoint), {
        method: 'POST', headers: { Authorization: 'Bearer ' + config.token },
        body: { title: question.title, type: question.type,
          options: question.options.map(option => option.text) },
        timeoutMs: config.timeoutMs, source: 'bank',
      });
      if (result?.status === 'error' || (result && Object.hasOwn(result, 'error'))) {
        throw new GatewayError('bank_business_error');
      }
      if (result && Object.hasOwn(result, 'code')) throw new GatewayError('bank_protocol_error');
      if (result?.status === 'miss' && !Object.hasOwn(result, 'answer')) return { kind: 'miss' };
      if (result?.status === 'hit' && Object.hasOwn(result, 'answer')) {
        return { kind: 'hit', answer: result.answer };
      }
      throw new GatewayError('bank_protocol_error');
    };
  }
  if (config.driver !== 'enncy-query-unverified' || config.allowUnverifiedProtocol !== true) {
    throw new GatewayError('enncy_protocol_not_verified', 500);
  }
  // Experimental mapping only. No real query was made to establish this protocol.
  const mapping = config.response;
  if (!mapping || !Array.isArray(mapping.successCodes) || !mapping.successCodes.length ||
      !Array.isArray(mapping.missCodes) || typeof mapping.answerPath !== 'string' ||
      mapping.successCodes.some(code => mapping.missCodes.includes(code))) {
    throw new GatewayError('bank_response_mapping_required', 500);
  }
  const typeMap = config.typeMap || {
    single: 'single', multiple: 'multiple', judgement: 'judgement', completion: 'completion', short: 'completion',
  };
  return async question => {
    const url = new URL(endpoint);
    url.searchParams.set('token', config.token);
    url.searchParams.set('title', question.title);
    url.searchParams.set('options', question.options.map(option => option.text).join('\n'));
    const mappedType = typeMap[question.type] ?? (question.type === 'short' ? typeMap.completion : undefined);
    if (mappedType === undefined) throw new GatewayError('bank_question_type_unsupported');
    url.searchParams.set('type', mappedType);
    const result = await upstreamJson(url, { source: 'bank', timeoutMs: config.timeoutMs });
    if (result && Object.hasOwn(result, 'error')) throw new GatewayError('bank_business_error');
    const code = valueAt(result, mapping.codePath || 'code');
    if (mapping.successCodes.includes(code)) {
      const answer = valueAt(result, mapping.answerPath);
      if (answer === undefined || answer === null || answer === '' ||
          (Array.isArray(answer) && answer.length === 0)) {
        throw new GatewayError('bank_empty_success');
      }
      return { kind: 'hit', answer };
    }
    if (mapping.missCodes.includes(code)) return { kind: 'miss' };
    // Unknown codes include expired credentials, insufficient credit, and throttling.
    // Their messages/response bodies are never passed into logs or client errors.
    throw new GatewayError('bank_business_error');
  };
}

function completion(answer, model, source, mode, protocolStatus = 'mock_only') {
  return {
    id: 'chatcmpl-' + randomUUID(), object: 'chat.completion',
    created: Math.floor(Date.now() / 1000), model,
    choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify({ answer }) },
      finish_reason: 'stop' }],
    gateway: { source, mode, protocolStatus },
  };
}

function mockLookup(account, question) {
  const entries = account.mock?.entries || [];
  const match = entries.find(entry => entry.type === question.type &&
    normalizeText(entry.title) === normalizeText(question.title) &&
    JSON.stringify((entry.options || []).map(normalizeText)) ===
    JSON.stringify(question.options.map(option => normalizeText(option.text))));
  return match ? { kind: 'hit', answer: match.answer } : { kind: 'miss' };
}

function timeoutSetting(value) {
  if (value === undefined) return 10000;
  if (!Number.isInteger(value) || value < 10 || value > 180000) {
    throw new GatewayError('invalid_timeout', 500);
  }
  return value;
}

function prepareAccounts(accounts, mode) {
  if (!Array.isArray(accounts) || !accounts.length || accounts.length > 32) {
    throw new GatewayError('accounts_required', 500);
  }
  const copy = structuredClone(accounts);
  const ids = new Set();
  const tokens = new Set();
  for (const account of copy) {
    if (typeof account.id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/u.test(account.id) || ['__proto__','constructor','prototype'].includes(account.id) || ids.has(account.id)) {
      throw new GatewayError('invalid_or_duplicate_account_id', 500);
    }
    ids.add(account.id);
    try { account.searchMethods=normalizeSearchMethods(account.searchMethods); }
    catch { throw new GatewayError('invalid_search_methods',500); }
    account.localToken ||= generateLocalToken();
    if (typeof account.localToken !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/u.test(account.localToken) ||
        tokens.has(account.localToken)) {
      throw new GatewayError('invalid_or_duplicate_local_token', 500);
    }
    tokens.add(account.localToken);
    account.tokenHash = createHash('sha256').update(account.localToken).digest();
    account.active = 0;
    account.maxConcurrent ??= 2;
    if (!Number.isInteger(account.maxConcurrent) || account.maxConcurrent < 1 || account.maxConcurrent > 16) {
      throw new GatewayError('invalid_concurrency', 500);
    }
    account.enrollmentYear=require('../enrollment-year.js').normalize(account.enrollmentYear);
    account.answerSettings=require('../answer-settings.js').normalize(account.answerSettings);
    account.wrapperAdapters=new Map();if(mode==='live')for(const bank of account.questionBanks||[])account.wrapperAdapters.set(bank.id,createWrapperAdapter({...bank,timeoutMs:account.answerSettings.answerWrapperHandlerTimeout*1000,answerSeparators:account.answerSettings.answerSeparators}));
    if (mode === 'live') {
      if (account.bank) {
        account.bank.timeoutMs = timeoutSetting(account.bank.timeoutMs);
        account.bankAdapter = makeBankAdapter(account.bank);
      }
      if(account.aiProviders){
        if(!Array.isArray(account.aiProviders)||account.aiProviders.length>16)throw new GatewayError('invalid_ai_providers',500);
        const ids=new Set();for(const ai of account.aiProviders){
          ai.type=require('../ai-config.js').type(ai);
          if(!require('../ai-config.js').isId(ai.id)||ids.has(ai.id)||typeof ai.apiKey!=='string'||(!ai.apiKey&&ai.type!=='ollama')||!ai.model||ai.extraHeaders!==undefined)throw new GatewayError('account_ai_configuration_required',500);
          ids.add(ai.id);ai.timeoutMs=timeoutSetting(ai.timeoutMs);ai.url=validateEndpoint(ai.endpoint);
        }
      }
      if (account.ai) {
        account.ai.timeoutMs = timeoutSetting(account.ai.timeoutMs);
        account.aiUrl = validateEndpoint(account.ai.endpoint);
        if (typeof account.ai.apiKey !== 'string' || (!account.ai.apiKey&&account.ai.type!=='ollama') || typeof account.ai.model !== 'string' || !account.ai.model) throw new GatewayError('account_ai_configuration_required', 500);
        if (account.ai.extraHeaders !== undefined) throw new GatewayError('extra_ai_headers_not_supported', 500);
      }
      if (account.xingchanBank) {
        account.xingchanBank.timeoutMs=timeoutSetting(account.xingchanBank.timeoutMs);
        account.originalBankAdapter=makeBankAdapter(account.xingchanBank);
      }
    }
  }
  return copy;
}

async function readJsonRequest(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY) throw new GatewayError('request_too_large', 413);
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new GatewayError('invalid_json', 400); }
}

function send(response, status, object) {
  if (response.destroyed || response.writableEnded) return;
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(object));
}

function createGateway(options = {}) {
  const mode = options.mode ?? 'mock';
  if (!['mock', 'live'].includes(mode)) throw new GatewayError('invalid_mode', 500);
  const defaultAccounts = [{ id: 'mock-account', mock: {
    entries: [{ type: 'single', title: '2+2等于几？', options: ['3', '4'], answer: 'B' }],
  } }];
  const accounts = prepareAccounts(options.accounts || defaultAccounts, mode);
  const emit = event => {
    // This allowlist logger never sees prompts, keys, URL strings, headers or error messages.
    const safe = { event: event.event, mode,
      ...(event.account ? { account: event.account } : {}),
      ...(event.source ? { source: event.source } : {}),
      ...(event.code ? { code: event.code } : {}),
      ...(Number.isInteger(event.status) ? { status: event.status } : {}),
    };
    try { options.logger?.(Object.freeze(safe)); } catch { /* Logging cannot change routing. */ }
  };
  const resolveAccount = authorization => {
    const token = typeof authorization === 'string' && /^Bearer [A-Za-z0-9_-]{32,128}$/u.test(authorization)
      ? authorization.slice(7) : '';
    const received = createHash('sha256').update(token).digest();
    let result;
    for (const account of accounts) {
      if (timingSafeEqual(received, account.tokenHash)) result = account;
    }
    return token ? result : undefined;
  };
  async function queryMethod(account,body,question,id) {
    if(id==='soutijiang'){
      if(mode!=='live'||typeof options.soutijiangSearch!=='function')throw new GatewayError('soutijiang_unavailable',503);
      let result;try{result=await options.soutijiangSearch(account.id,question);}catch(error){throw new GatewayError(error.code||'soutijiang_query_failed',error.status||502);}
      if(result?.kind==='miss'&&result.explicitMiss===true){emit({event:'miss',account:account.id,source:id});return null;}
      if(result?.kind!=='hit')throw new GatewayError('soutijiang_protocol_error');
      const answer=normalizeBankAnswer(question,result.answer);emit({event:'answer',account:account.id,source:id,status:200});return completion(answer,'configured-search-order',id,mode,'official-extension');
    }
    if(mode==='live'&&options.originalSearch&&(require('../ai-config.js').isId(id)||id==='xingchan-bank')){
      const result=await options.originalSearch(id,question);
      if(result?.kind==='miss'&&result.explicitMiss===true)return null;
      if(result?.kind!=='hit')throw new GatewayError('original_provider_protocol_error');
      return completion(normalizeBankAnswer(question,result.answer),'configured-search-order',id,mode,'original-xingchan-module');
    }
    if(/^ocs-/.test(id)&&!account.wrapperAdapters.has(id))throw new GatewayError('ocs_bank_configuration_required',503);
    if(account.wrapperAdapters.has(id)){
      let result;try{result=await account.wrapperAdapters.get(id)(question);}catch(error){throw new GatewayError(error.code||'ocs_bank_query_failed');}
      if(result.kind==='miss'){emit({event:'miss',account:account.id,source:id});return null;}
      const answer=question.browser?result.answer:normalizeBankAnswer(question,result.answer,(account.questionBanks||[]).find(b=>b.id===id)?.wrapper.answerSeparators?.[0]);
      emit({event:'answer',account:account.id,source:id,status:200});return completion(answer,'configured-search-order','bank',mode,'ocs-wrapper');
    }
    if(id==='yanxi'||id==='xingchan-bank'){
      const original=id==='xingchan-bank';
      const config=original?account.xingchanBank:account.bank;
      const source=original?(mode==='mock'?'xingchan_bank_mock':'xingchan_bank'):'bank';
      const adapter=original?account.originalBankAdapter:account.bankAdapter;
      if(mode==='live'&&!adapter)throw new GatewayError(original?'original_bank_adapter_not_configured':'bank_configuration_required',503);
      const result=mode==='mock'?mockLookup(original?{mock:{entries:account.mock?.originalBankEntries||[]}}:account,question):await adapter(question);
      if(result.kind==='miss'){emit({event:'miss',account:account.id,source});return null;}
      if(result.kind!=='hit')throw new GatewayError('bank_protocol_error');
      const answer=normalizeBankAnswer(question,result.answer,config?.answerSeparator);
      emit({event:'answer',account:account.id,source,status:200});
      const protocolStatus=mode==='mock'?'mock_only':config.driver==='yanxi-post-v2'?'observed-post-v2':config.driver==='xingchan-original'?'original-xingchan-module':'adapter_contract_v1';
      return completion(answer,'configured-search-order',source,mode,protocolStatus);
    }
    if(mode==='mock'){
      if(account.mock?.aiAnswer===undefined)throw new GatewayError('mock_ai_answer_not_configured',503);
      if(account.mock.aiAnswer===null){emit({event:'miss',account:account.id,source:'ai_mock'});return null;}
      const answer=normalizeBankAnswer(question,account.mock.aiAnswer);
      emit({event:'answer',account:account.id,source:'ai_mock',status:200});
      return completion(answer,'mock-only-no-real-ai','ai_mock',mode);
    }
    const ai=account.aiProviders?.find(item=>item.id===id)||(id==='xingchan-ai'?account.ai:null),aiUrl=ai?.url||(id==='xingchan-ai'?account.aiUrl:null);
    if(!ai||!aiUrl)throw new GatewayError('account_ai_configuration_required',503);
    if(ai.driver==='xingchan-original-ai'){
      const data=await upstreamJson(new URL(aiUrl),{method:'POST',source:'ai',timeoutMs:Math.min(ai.timeoutMs,question.timeoutMs||Infinity),headers:{'X-Token':ai.sessionToken},body:{title:question.title,type:question.type,options:question.options,courseName:question.courseName||'',blankCount:question.blankCount??(question.type==='completion'?1:0),key:ai.apiKey,enrollmentYear:account.enrollmentYear,ai:{baseUrl:ai.baseUrl,model:ai.model,type:ai.type}}});
      if(data?.kind==='miss'&&data.explicitMiss===true){emit({event:'miss',account:account.id,source:id});return null;}
      if(data?.kind!=='hit')throw new GatewayError('ai_protocol_error');
      const answer=normalizeBankAnswer(question,data.answer);
      emit({event:'answer',account:account.id,source:id,status:200});
      return completion(answer,ai.model,id,mode,'original-xingchan-module');
    }
    const requestBody={model:ai.model,messages:body.messages,stream:false};
    if(ai.temperature!==undefined)requestBody.temperature=ai.temperature;
    if(ai.maxTokens!==undefined)requestBody.max_tokens=ai.maxTokens;
    const data=await upstreamJson(new URL(aiUrl),{method:'POST',source:'ai',timeoutMs:Math.min(ai.timeoutMs,question.timeoutMs||Infinity),headers:{Authorization:'Bearer '+ai.apiKey},body:requestBody});
    const content=data?.choices?.[0]?.message?.content;
    if(typeof content!=='string')throw new GatewayError('ai_protocol_error');
    let parsed,answer;
    try{
      parsed=JSON.parse(content.trim().replace(/^```(?:json)?\s*|\s*```$/gu,''));
      if(!Object.hasOwn(parsed,'answer'))throw Error();
      if(parsed.answer!==null)answer=normalizeBankAnswer(question,parsed.answer);
    }catch{throw new GatewayError('ai_answer_invalid');}
    if(parsed.answer===null){emit({event:'miss',account:account.id,source:'ai'});return null;}
    emit({event:'answer',account:account.id,source:'ai',status:200});
    return completion(answer,ai.model,'ai',mode,'adapter_contract_v1');
  }
  async function orderedQuery(account,body,question,deadline=Infinity){
    const methods=account.searchMethods.filter(item=>item.enabled);
    if(!methods.length)throw new GatewayError('all_search_methods_disabled',409);
    let failed=false;
    for(const method of methods){
      question.timeoutMs=Math.max(1,deadline-Date.now());
      if(question.timeoutMs<=1)throw new GatewayError('question_search_timeout',504);
      try{const result=await queryMethod(account,body,question,method.id);if(result)return result;}
      catch(error){failed=true;emit({event:'method_error',account:account.id,source:method.id,code:error instanceof GatewayError?error.code:'search_method_failed'});}
    }
    // An error is not evidence that no answer exists. Never allow random fallback then.
    if(failed)throw new GatewayError('search_incomplete_due_to_errors',502);
    return null;
  }
  async function structuredQuery(account,body,browser=false){
    const types={single:'单选题',multiple:'多选题',completion:'填空题',judgement:'判断题',short:'简答题'};
    if(browser)Object.assign(types,{line:'连线题',unknown:'未知题型'});
    if(!types[body.type]||typeof body.title!=='string'||!body.title.trim()||body.title.length>16000||!Array.isArray(body.options)||body.options.length>26||body.options.some((o,i)=>!o||o.label!==String.fromCharCode(65+i)||typeof o.text!=='string'||!o.text.trim()))throw new GatewayError('invalid_question',400);
    if(body.type==='completion'&&(!Number.isInteger(body.blankCount)||body.blankCount<1||body.blankCount>100))throw new GatewayError('invalid_blank_count',400);
    if(body.courseName!==undefined&&(typeof body.courseName!=='string'||body.courseName.length>500))throw new GatewayError('invalid_course_name',400);
    const settings=account.answerSettings,question={title:body.title,type:body.type,options:body.options,blankCount:body.blankCount,courseName:body.courseName||'',browser};
    for(const word of settings.redundanceWordsText.split(/\r?\n/).map(v=>v.trim()).filter(Boolean))question.title=question.title.split(word).join('');
    question.title=question.title.trim();if(!question.title)throw new GatewayError('empty_question_after_cleanup',400);
    const deadline=Date.now()+settings.answerWrapperHandlerTimeout*1000;
    question.images=[];
    if(browser){
      if(!Array.isArray(body.images)||body.images.length>64||body.images.some(v=>typeof v!=='string'||v.length>6*1048576))throw new GatewayError('invalid_question_images',400);
      if(settings.imageOptimize)question.images=body.images;
      for(const key of ['suggestion_title','suggestion_options'])question[key]=typeof body[key]==='string'?body[key].slice(0,24000):'';
    }else if(settings.imageOptimize&&account.searchMethods.some(m=>m.enabled&&account.wrapperAdapters.has(m.id)))Object.assign(question,await require('../question-images.cjs').prepare(question,{deadline}));
    const prompt='题目类型：'+types[question.type]+'\n题干：'+question.title+(body.type==='completion'?'\n填空数量：'+body.blankCount+' 个':'')+(question.options.length?'\n选项：\n'+question.options.map(o=>o.label+'. '+o.text).join('\n'):'')+'\n作答要点：返回答案 JSON';
    const request={messages:[{role:'user',content:prompt}]};
    const result=await orderedQuery(account,request,question,deadline);if(result)return {kind:'hit',answer:JSON.parse(result.choices[0].message.content).answer};
    return {kind:'miss'};
  }
  async function query(account,body){
    if(body.stream===true)throw new GatewayError('streaming_not_supported',400);
    const methods=account.searchMethods.filter(item=>item.enabled);
    if(!methods.length)throw new GatewayError('all_search_methods_disabled',409);
    const question=parseQuestionPrompt(body.messages);
    const result=await orderedQuery(account,body,question,Date.now()+account.answerSettings.answerWrapperHandlerTimeout*1000);if(result)return result;
    throw new GatewayError('no_answer_from_enabled_methods',404);
  }
  const server = http.createServer(async (request, response) => {
    let account;
    let active = false;
    try {
      if (request.headers.origin) throw new GatewayError('browser_origin_not_allowed', 403);
      const allowedHost = HOST + ':' + server.address()?.port;
      if (request.headers.host !== allowedHost) throw new GatewayError('invalid_host', 403);
      if (request.method === 'GET' && request.url === '/health') {
        return send(response, 200, { ok: true, mode, host: HOST, accountCount: accounts.length });
      }
      if (request.method !== 'POST' || !['/v1/chat/completions','/v1/fusion/query'].includes(request.url)) {
        throw new GatewayError('not_found', 404);
      }
      account = resolveAccount(request.headers.authorization);
      if (!account) throw new GatewayError('local_authentication_required', 401);
      if (!/^application\/json(?:\s*;|$)/iu.test(request.headers['content-type'] || '')) {
        throw new GatewayError('json_content_type_required', 415);
      }
      if (account.active >= account.maxConcurrent) throw new GatewayError('account_busy', 429);
      account.active += 1;
      active = true;
      const body = await readJsonRequest(request);
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new GatewayError('invalid_request', 400);
      send(response, 200, request.url==='/v1/fusion/query'?await structuredQuery({...account},body):await query({...account}, body));
    } catch (error) {
      const safe = error instanceof GatewayError ? error : new GatewayError('internal_error', 500);
      emit({ event: 'request_error', account: account?.id, code: safe.code, status: safe.status });
      send(response, safe.status, { error: { message: safe.code, type: 'gateway_error', code: safe.code } });
    } finally {
      if (active) account.active -= 1;
    }
  });
  server.headersTimeout = 10000;
  server.requestTimeout = 30000;
  server.keepAliveTimeout = 1000;
  return {
    server,
    mode,
    async queryBrowser(id,body){const account=accounts.find(item=>item.id===id);if(!account)throw new GatewayError('unknown_account',404);return structuredQuery(account,body,body.normalized!==true);},
    updateAnswerSettings(id,value){
      const account=accounts.find(item=>item.id===id);if(!account)throw new GatewayError('unknown_account',404);
      const settings=require('../answer-settings.js').normalize(value),adapters=new Map();
      if(mode==='live')for(const bank of account.questionBanks||[])adapters.set(bank.id,createWrapperAdapter({...bank,timeoutMs:settings.answerWrapperHandlerTimeout*1000,answerSeparators:settings.answerSeparators}));
      account.answerSettings=settings;account.wrapperAdapters=adapters;account.maxConcurrent=settings.thread;
    },
    updateSearchMethods(id,value){
      const account=accounts.find(item=>item.id===id);
      if(!account)throw new GatewayError('unknown_account',404);
      try{account.searchMethods=normalizeSearchMethods(value);}
      catch{throw new GatewayError('invalid_search_methods',400);}
      return account.searchMethods.map(item=>({...item}));
    },
    async listen(port = 0) {
      if (!Number.isInteger(port) || port < 0 || port > 65535) throw new GatewayError('invalid_port', 500);
      await new Promise((resolve, reject) => {
        const fail = error => { server.off('listening', ready); reject(error); };
        const ready = () => { server.off('error', fail); resolve(); };
        server.once('error', fail);
        server.once('listening', ready);
        server.listen(port, HOST);
      });
      emit({ event: 'listening' });
      return { host: HOST, port: server.address().port, baseUrl: 'http://' + HOST + ':' + server.address().port + '/v1', mode };
    },
    clientProfiles() {
      if (!server.listening) throw new GatewayError('not_listening', 500);
      return accounts.map(account => ({ id: account.id,
        baseUrl: 'http://' + HOST + ':' + server.address().port + '/v1',
        apiKey: account.localToken, model: 'bank-first', mode }));
    },
    async close() {
      if (!server.listening) return;
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      server.closeAllConnections();
    },
  };
}

module.exports = { createGateway, generateLocalToken, parseQuestionPrompt, normalizeBankAnswer,
  makeBankAdapter, GatewayError };
