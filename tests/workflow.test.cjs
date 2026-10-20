const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'SubinboxAI.js'), 'utf8');

function setup() {
  const properties = new Map();
  const state = { threads: [], triggers: [], emails: [], labels: new Map(), apiCode: 200,
    finishReason: 'STOP', markdown: '## Tech & Engineering\n### Example\n- Search is faster.\n- Enable it in Settings.',
    failSend: false, failLabel: false, failWeekly: false, onGenerate: null, locked: false };
  const context = vm.createContext({
    PropertiesService: { getUserProperties: () => ({
      getProperty: key => properties.get(key) || null,
      setProperty: (key, value) => { properties.set(key, value); }
    }) },
    Session: { getScriptTimeZone: () => 'Europe/Berlin', getEffectiveUser: () => ({ getEmail: () => 'owner@example.com' }) },
    LockService: { getUserLock: () => ({ tryLock: () => !state.locked, releaseLock() {} }) },
    ScriptApp: {
      WeekDay: { SUNDAY: 'SUNDAY' }, getProjectTriggers: () => [...state.triggers],
      deleteTrigger: trigger => { state.triggers = state.triggers.filter(item => item !== trigger); },
      newTrigger: handler => {
        const builder = { timeBased: () => builder, everyDays: () => builder, atHour: () => builder,
          inTimezone: () => builder, onWeekDay: () => builder,
          create: () => {
            if (state.failWeekly && handler === 'cleanupOldNewsletters') throw new Error('Trigger quota');
            const trigger = { getHandlerFunction: () => handler };
            state.triggers.push(trigger); return trigger;
          } };
        return builder;
      }
    },
    GmailApp: {
      getUserLabelByName: name => state.labels.get(name),
      createLabel: name => { const label = { name }; state.labels.set(name, label); return label; },
      search: query => state.threads.filter(thread => !query.includes('in:inbox') || (thread.inbox && thread.digested)),
      sendEmail: (to, subject, text, options) => {
        if (state.failSend) throw new Error('Mail quota');
        state.emails.push({ to, subject, text, ...options });
      }
    },
    UrlFetchApp: { fetch: () => {
      if (state.onGenerate) state.onGenerate();
      return { getResponseCode: () => state.apiCode, getContentText: () => JSON.stringify({
        candidates: [{ finishReason: state.finishReason, content: { parts: [{ text: state.markdown }] } }]
      }) };
    } },
    Utilities: { formatDate: () => 'Tue, Oct 20, 2026' },
    HtmlService: { createHtmlOutput: html => ({ html, setTitle() { return this; }, addMetaTag() { return this; } }) }
  });
  vm.runInContext(source, context);
  function activate(overrides = {}) {
    return context.activateWorkflow({ apiKey: 'test-key-for-offline-simulation', hour: 7, recipientEmail: '', autoArchive: true, ...overrides });
  }
  function thread(ids = ['one'], ageHours = 0) {
    const item = { inbox: true, digested: false, messages: [],
      refresh() { return this; },
      getMessages() { return this.messages; },
      getLastMessageDate() { return new Date(Math.max(...this.messages.map(message => message.getDate().getTime()))); },
      addLabel() { if (state.failLabel) throw new Error('Label failure'); this.digested = true; },
      moveToArchive() { this.inbox = false; }
    };
    item.messages = ids.map(id => ({ getId: () => id, getDate: () => new Date(Date.now() - ageHours * 3600000),
      getSubject: () => 'Search update', getFrom: () => 'Newsletter <news@example.com>',
      getBody: () => '<style>hidden</style><p>Search is faster.</p><img src="tracking"><a href="https://track.example/long">Enable it</a>',
      isDraft: () => false }));
    state.threads.push(item); return item;
  }
  return { context, state, properties, activate, thread };
}

test('activation replaces only its own schedules and keeps the saved key private', () => {
  const app = setup();
  const unrelated = { getHandlerFunction: () => 'unrelatedJob' };
  app.state.triggers.push(unrelated);
  assert.equal(app.activate().ok, true);
  assert.equal(app.activate({ apiKey: '', recipientEmail: 'reader@icloud.com' }).ok, true);
  assert.equal(app.context.getSetupStatus().active, true);
  assert.equal(app.context.getSetupStatus().recipientEmail, 'reader@icloud.com');
  assert.equal(app.context.getSetupStatus().apiKey, undefined);
  assert.deepEqual(app.state.triggers.map(t => t.getHandlerFunction()).sort(), ['cleanupOldNewsletters', 'sendDailyNewsletterDigest', 'unrelatedJob']);
  assert.equal(app.state.emails.at(-1).to, 'reader@icloud.com');
});

test('invalid preferences or rejected key leave an existing installation intact', () => {
  const app = setup(); app.activate();
  const before = app.properties.get('config');
  assert.equal(app.activate({ hour: 23 }).ok, false);
  assert.equal(app.activate({ recipientEmail: 'victim@example.com,other@example.com' }).ok, false);
  app.state.apiCode = 403;
  assert.equal(app.activate({ hour: 8 }).ok, false);
  assert.equal(app.properties.get('config'), before);
  assert.equal(app.context.getSetupStatus().active, true);
});

test('partial schedule creation failure preserves the previous installation', () => {
  const app = setup(); app.activate(); const before = app.properties.get('config');
  app.state.failWeekly = true;
  assert.equal(app.activate({ hour: 8 }).ok, false);
  assert.equal(app.properties.get('config'), before);
  assert.equal(app.state.triggers.length, 2);
});

test('daily delivery does not resend old messages but includes new mail in a digested conversation', () => {
  const app = setup(); app.activate(); const original = app.thread();
  assert.equal(app.context.sendDailyNewsletterDigest().count, 1);
  assert.equal(original.inbox, false);
  assert.equal(original.digested, true);
  assert.equal(app.context.sendDailyNewsletterDigest().sent, false);
  original.messages.push(app.thread(['new-message']).messages[0]); app.state.threads.pop();
  assert.equal(app.context.sendDailyNewsletterDigest().count, 1);
  assert.equal(app.state.emails.length, 3);
});

test('API, truncated response, and email failures leave newsletters pending', () => {
  for (const failure of ['api', 'truncated', 'email']) {
    const app = setup(); app.activate(); const original = app.thread();
    if (failure === 'api') app.state.apiCode = 429;
    if (failure === 'truncated') app.state.finishReason = 'MAX_TOKENS';
    if (failure === 'email') app.state.failSend = true;
    assert.throws(() => app.context.sendDailyNewsletterDigest());
    assert.equal(original.digested, false);
    assert.equal(original.inbox, true);
    app.state.apiCode = 200; app.state.finishReason = 'STOP'; app.state.failSend = false;
    assert.equal(app.context.sendDailyNewsletterDigest().count, 1);
  }
});

test('label failure after sending does not cause another email on the next run', () => {
  const app = setup(); app.activate(); app.thread(); app.state.failLabel = true;
  assert.throws(() => app.context.sendDailyNewsletterDigest());
  app.state.failLabel = false;
  assert.equal(app.context.sendDailyNewsletterDigest().sent, false);
  assert.equal(app.state.emails.length, 2);
});

test('message cap does not mark or archive a partially processed conversation', () => {
  const app = setup(); app.activate(); const original = app.thread(Array.from({ length: 21 }, (_, index) => 'mail-' + index));
  assert.equal(app.context.sendDailyNewsletterDigest().count, 20);
  assert.equal(original.digested, false);
  assert.equal(original.inbox, true);
  assert.equal(app.context.sendDailyNewsletterDigest().count, 1);
  assert.equal(original.digested, true);
});

test('mail arriving during generation remains in the inbox and is not marked as digested', () => {
  const app = setup(); app.activate(); const original = app.thread();
  app.state.onGenerate = () => {
    original.messages.push(app.thread(['arrived-during-generation']).messages[0]);
    app.state.threads.pop();
  };
  app.context.sendDailyNewsletterDigest();
  assert.equal(original.inbox, true);
  assert.equal(original.digested, false);
});

test('email renderer escapes model HTML instead of executing or loading it', () => {
  const app = setup(); app.activate(); app.thread();
  app.state.markdown = '## Tech\n- <img src=x onerror=alert(1)> & <script>bad()</script>';
  app.context.sendDailyNewsletterDigest();
  const email = app.state.emails.at(-1);
  assert.ok(email.htmlBody.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!email.htmlBody.includes('<script>'));
  assert.ok(email.text.includes('<script>bad()</script>'));
});

test('cleanup archives only old, digested conversations when archiving is enabled', () => {
  const app = setup(); app.activate();
  const old = app.thread(['old'], 31 * 24); old.digested = true;
  const fresh = app.thread(['fresh']); fresh.digested = true;
  const pending = app.thread(['pending'], 31 * 24);
  app.context.cleanupOldNewsletters();
  assert.equal(old.inbox, false); assert.equal(fresh.inbox, true); assert.equal(pending.inbox, true);
  app.activate({ autoArchive: false }); old.inbox = true;
  app.context.cleanupOldNewsletters(); assert.equal(old.inbox, true);
});
