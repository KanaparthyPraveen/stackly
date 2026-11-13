/**
 * Stackly end-to-end check against a running backend + MongoDB (+ R2).
 *
 *   node scripts/e2e-smoke.mjs
 *
 * Environment:
 *   API_BASE   Base URL of the API (default http://127.0.0.1:3001/api/v1)
 *   SKIP_R2    Set to "1" when object storage is not configured
 *
 * The script creates its own throwaway accounts and deletes them at the end.
 * It makes several hundred requests in a few seconds, so run the API with
 * RATE_LIMIT_PER_MINUTE=5000 or the baseline rate limit will (correctly)
 * start rejecting it.
 */

const BASE = process.env.API_BASE || 'http://127.0.0.1:3001/api/v1';
const SKIP_R2 = process.env.SKIP_R2 === '1';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const PHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

let pass = 0;
let fail = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    pass += 1;
    console.log(`  PASS  ${name}`);
  } else {
    fail += 1;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

const brief = (value) => JSON.stringify(value ?? null).slice(0, 200);

/** Minimal cookie-aware fetch wrapper — one instance behaves like one browser. */
function makeClient(userAgent = BROWSER_UA) {
  const jar = new Map();

  function absorb(res) {
    for (const line of res.headers.getSetCookie?.() ?? []) {
      const [pair] = line.split(';');
      const idx = pair.indexOf('=');
      if (idx <= 0) continue;
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      if (value === '' || /expires=Thu, 01 Jan 1970/i.test(line)) jar.delete(name);
      else jar.set(name, value);
    }
  }

  async function call(method, path, body, opts = {}) {
    const headers = { 'User-Agent': userAgent, ...(opts.headers ?? {}) };
    if (jar.size) {
      headers.Cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    }

    let payload;
    if (body instanceof FormData) {
      payload = body;
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }

    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: payload,
      redirect: 'manual',
    });
    absorb(res);

    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* not json */
    }
    return {
      status: res.status,
      body: json,
      text,
      headers: res.headers,
      location: res.headers.get('location') ?? '',
    };
  }

  return {
    get: (p, o) => call('GET', p, undefined, o),
    post: (p, b, o) => call('POST', p, b, o),
    put: (p, b, o) => call('PUT', p, b, o),
    patch: (p, b, o) => call('PATCH', p, b, o),
    del: (p, o) => call('DELETE', p, undefined, o),
    jar,
  };
}

/** A real 1x1 PNG. */
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const PDF_BYTES = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');

function fileForm(bytes, type, name) {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type }), name);
  return form;
}

const FAKE_ID = 'ffffffffffffffffffffffff';

async function main() {
  const stamp = Date.now();
  const suffix = stamp.toString().slice(-8);
  const alice = makeClient();
  const bob = makeClient();
  const visitor = makeClient(PHONE_UA);

  /* ── Health ─────────────────────────────────────────────────────── */
  section('Health & configuration');
  const health = await alice.get('/health');
  check('health endpoint responds 200', health.status === 200, `status ${health.status}`);
  check('health reports a live database connection', health.body?.database === 'connected', brief(health.body));
  check('security headers are set', health.headers.get('x-content-type-options') === 'nosniff' && !health.headers.get('x-powered-by'));

  const providers = await alice.get('/auth/oauth/providers');
  const authProviders = providers.body?.providers ?? [];
  const githubConfigured = authProviders.find((p) => p.name === 'github')?.configured === true;
  const googleConfigured = authProviders.find((p) => p.name === 'google')?.configured === true;
  check('sign-in providers are advertised', authProviders.length === 2, brief(providers.body));
  console.log(`        github configured: ${githubConfigured}, google configured: ${googleConfigured}`);

  /* ── Registration & session ─────────────────────────────────────── */
  section('Registration, login & sessions');
  const email = `alice+${stamp}@example.com`;
  const password = 'supersecret1';

  const anonMe = await alice.get('/auth/me');
  check('unauthenticated /auth/me is rejected', anonMe.status === 401, `status ${anonMe.status}`);

  const weak = await alice.post('/auth/register', { email: `weak+${stamp}@example.com`, password: 'short' });
  check('weak password is rejected', weak.status === 400, `status ${weak.status}`);

  const reg = await alice.post('/auth/register', { email, password });
  check('register returns 201', reg.status === 201, `status ${reg.status} ${reg.text}`);
  check('register response has no password material', !reg.text.includes('passwordHash') && !reg.text.includes(password));

  const dupe = await makeClient().post('/auth/register', { email, password });
  check('duplicate email is rejected with 409', dupe.status === 409, `status ${dupe.status}`);

  const me = await alice.get('/auth/me');
  check('session cookie authenticates /auth/me', me.status === 200 && me.body?.user?.email === email, brief(me.body));

  const account = await alice.get('/auth/account');
  check('account reports a password and no linked providers', account.body?.hasPassword === true && (account.body?.identities ?? []).length === 0, brief(account.body));

  // Session fixation: the id presented before login must not survive it.
  const fixation = makeClient();
  await fixation.get('/auth/github'); // creates a pre-auth session when OAuth is configured
  const before = fixation.jar.get('stackly.sid');
  const login = await fixation.post('/auth/login', { email, password });
  const after = fixation.jar.get('stackly.sid');
  check('login succeeds on a second device', login.status === 200, `status ${login.status}`);
  check('session id is rotated at login', Boolean(after) && after !== before);

  const badLogin = await makeClient().post('/auth/login', { email, password: 'wrong-password' });
  check('wrong password is rejected with 401', badLogin.status === 401, `status ${badLogin.status}`);

  const sessions = await alice.get('/auth/sessions');
  check('both sessions are listed', (sessions.body ?? []).length === 2, brief(sessions.body));
  check('exactly one session is marked current', (sessions.body ?? []).filter((s) => s.current).length === 1);
  check('session list never exposes session ids', !sessions.text.includes(decodeURIComponent(alice.jar.get('stackly.sid') ?? 'x').slice(2, 20)));

  const revoked = await alice.post('/auth/sessions/revoke-others');
  check('other sessions can be revoked', revoked.status === 200 && revoked.body?.revoked === 1, brief(revoked.body));
  const kicked = await fixation.get('/auth/me');
  check('the revoked device is signed out', kicked.status === 401, `status ${kicked.status}`);
  const stillIn = await alice.get('/auth/me');
  check('the current device stays signed in', stillIn.status === 200);

  /* ── Profile ────────────────────────────────────────────────────── */
  section('Profile, username & publishing');
  const auto = await alice.get('/profile/me');
  check('a profile is created at registration', auto.status === 200 && typeof auto.body?.username === 'string', brief(auto.body));
  check('a new profile starts unpublished', auto.body?.live === false);

  const username = `ada_${suffix}`;
  const avail = await alice.get(`/profile/availability/${username}`);
  check('free username is reported available', avail.body?.available === true, brief(avail.body));
  const reserved = await alice.get('/profile/availability/dashboard');
  check('reserved username is reported unavailable', reserved.body?.available === false);

  const claimed = await alice.post('/profile/me', { username });
  check('username can be claimed', (claimed.status === 201 || claimed.status === 200) && claimed.body?.username === username, `status ${claimed.status} ${claimed.text}`);
  const taken = await alice.get(`/profile/availability/${username}`);
  check('claimed username is no longer available', taken.body?.available === false);

  const badName = await alice.patch('/profile/me', { username: 'Not Valid!' });
  check('invalid username is rejected', badName.status === 400, `status ${badName.status}`);

  const edited = await alice.patch('/profile/me', {
    displayName: 'Ada Lovelace',
    bio: 'Building things.',
    location: 'London',
    website: 'https://example.com',
    social: { github: 'https://github.com/ada', x: 'https://x.com/ada' },
  });
  check('profile fields are saved', edited.status === 200 && edited.body?.displayName === 'Ada Lovelace' && edited.body?.social?.x === 'https://x.com/ada', brief(edited.body));

  const partialSocial = await alice.patch('/profile/me', { social: { linkedin: 'https://linkedin.com/in/ada' } });
  check('updating one social link keeps the others', partialSocial.body?.social?.github === 'https://github.com/ada' && partialSocial.body?.social?.linkedin === 'https://linkedin.com/in/ada', brief(partialSocial.body?.social));

  const cleared = await alice.patch('/profile/me', { location: '', social: { x: '' } });
  const reread = await alice.get('/profile/me');
  check('an empty value clears a field', cleared.status === 200 && !reread.body?.location && !reread.body?.social?.x && reread.body?.bio === 'Building things.', brief(reread.body));

  const scriptUrl = await alice.patch('/profile/me', { website: 'javascript:alert(1)' });
  check('script URLs are rejected', scriptUrl.status === 400, `status ${scriptUrl.status}`);

  const hiddenFromVisitor = await visitor.get(`/profile/${username}`);
  check('an unpublished profile is invisible to visitors', hiddenFromVisitor.status === 200 && hiddenFromVisitor.body === null, brief(hiddenFromVisitor.body));
  const ownerPreview = await alice.get(`/profile/${username}`);
  check('the owner can preview their unpublished profile', ownerPreview.body?.username === username);
  const hiddenLinks = await visitor.get(`/links/public/${username}`);
  check('an unpublished profile exposes no public content', hiddenLinks.status === 404, `status ${hiddenLinks.status}`);

  const published = await alice.post('/profile/me/publish');
  check('profile can be published', published.body?.live === true, brief(published.body));
  const pub = await visitor.get(`/profile/${username}`);
  check('a published profile is visible to visitors', pub.body?.username === username, brief(pub.body));
  const publicKeys = Object.keys(pub.body ?? {}).sort().join(',');
  check(
    'public profile returns only approved fields',
    publicKeys === 'appearance,avatarUrl,bio,displayName,ghostMode,live,location,social,username,website' ||
      publicKeys === 'appearance,bio,displayName,ghostMode,live,social,username,website',
    publicKeys,
  );
  check('public profile leaks no ids, emails or timestamps', !/userId|_id|createdAt|updatedAt|@example\.com/.test(pub.text));

  /* ── Appearance ─────────────────────────────────────────────────── */
  section('Appearance — every control persists');
  const appearanceCases = [
    ['accent', { accent: 'jade' }, (a) => a.accent === 'jade'],
    ['background', { background: 'gradient' }, (a) => a.background === 'gradient'],
    ['typography preset', { typography: 'editorial' }, (a) => a.typography === 'editorial'],
    ['buttonStyle', { buttonStyle: 'square' }, (a) => a.buttonStyle === 'square'],
    ['layout', { layout: 'compact' }, (a) => a.layout === 'compact'],
    ['colors.primary', { colors: { primary: '#FF0055' } }, (a) => a.colors?.primary === '#FF0055'],
    ['colors.background', { colors: { background: '#101010' } }, (a) => a.colors?.background === '#101010'],
    ['surface.style', { surface: { style: 'elevated' } }, (a) => a.surface?.style === 'elevated'],
    ['surface.color', { surface: { color: '#222222' } }, (a) => a.surface?.color === '#222222'],
    ['surface.opacity', { surface: { opacity: 42 } }, (a) => a.surface?.opacity === 42],
    ['surface.radius', { surface: { radius: 8 } }, (a) => a.surface?.radius === 8],
    ['surface.borderWidth', { surface: { borderWidth: 3 } }, (a) => a.surface?.borderWidth === 3],
    ['typographyScale.heading', { typographyScale: { heading: 48 } }, (a) => a.typographyScale?.heading === 48],
    ['typographyScale.body', { typographyScale: { body: 18 } }, (a) => a.typographyScale?.body === 18],
    ['button.radius', { button: { radius: 4 } }, (a) => a.button?.radius === 4],
    ['button.height', { button: { height: 'lg' } }, (a) => a.button?.height === 'lg'],
    ['canvas.width', { canvas: { width: 'wide' } }, (a) => a.canvas?.width === 'wide'],
    ['canvas.padding', { canvas: { padding: 12 } }, (a) => a.canvas?.padding === 12],
    ['canvas.spacing', { canvas: { spacing: 64 } }, (a) => a.canvas?.spacing === 64],
    ['canvas.align', { canvas: { align: 'left' } }, (a) => a.canvas?.align === 'left'],
  ];

  for (const [label, patch, predicate] of appearanceCases) {
    const res = await alice.patch('/profile/me/appearance', patch);
    // Read back with a separate request: the value must come from MongoDB.
    const readBack = await alice.get('/profile/me/appearance');
    check(
      `${label} saved and reloaded`,
      res.status === 200 && readBack.status === 200 && predicate(readBack.body ?? {}),
      `PATCH ${res.status}, GET ${brief(readBack.body)}`,
    );
  }

  const full = (await alice.get('/profile/me/appearance')).body ?? {};
  check(
    'earlier settings survive later ones',
    full.accent === 'jade' && full.background === 'gradient' && full.layout === 'compact' &&
      full.colors?.primary === '#FF0055' && full.surface?.style === 'elevated' && full.surface?.opacity === 42 &&
      full.typographyScale?.heading === 48 && full.button?.height === 'lg' && full.canvas?.width === 'wide',
    brief(full),
  );

  await alice.patch('/profile/me/appearance', { colors: { primary: null } });
  const afterReset = (await alice.get('/profile/me/appearance')).body ?? {};
  check('a custom colour can be reset', afterReset.colors?.primary === undefined && afterReset.colors?.background === '#101010', brief(afterReset.colors));

  const pubAppearance = (await visitor.get(`/profile/${username}`)).body?.appearance ?? {};
  check('saved appearance is applied to the public profile', pubAppearance.accent === 'jade' && pubAppearance.canvas?.width === 'wide' && pubAppearance.surface?.opacity === 42, brief(pubAppearance));

  section('Appearance — validation & isolation');
  check('invalid accent rejected', (await alice.patch('/profile/me/appearance', { accent: 'not-a-theme' })).status === 400);
  check('invalid colour rejected', (await alice.patch('/profile/me/appearance', { colors: { primary: 'red' } })).status === 400);
  check('out-of-range value rejected', (await alice.patch('/profile/me/appearance', { surface: { opacity: 9999 } })).status === 400);
  check('unknown key rejected', (await alice.patch('/profile/me/appearance', { hacker: true })).status === 400);
  check('rejected updates changed nothing', (await alice.get('/profile/me/appearance')).body?.accent === 'jade');

  const bobEmail = `bob+${stamp}@example.com`;
  await bob.post('/auth/register', { email: bobEmail, password });
  const bobUsername = `bob_${suffix}`;
  await bob.post('/profile/me', { username: bobUsername });
  const bobDefault = (await bob.get('/profile/me/appearance')).body ?? {};
  check('a second user starts from defaults, not from the first user', bobDefault.accent === 'signal' && bobDefault.canvas?.width === 'standard', brief(bobDefault));

  const stolen = await bob.get(`/profiles/${username}/appearance`);
  check("another user cannot read someone else's appearance settings", [403, 404].includes(stolen.status), `status ${stolen.status}`);
  const stealPatch = await bob.patch(`/profiles/${username}/appearance`, { accent: 'rose' });
  check("another user cannot change someone else's appearance", [403, 404].includes(stealPatch.status), `status ${stealPatch.status}`);
  check('the owner is unaffected by the attempt', (await alice.get('/profile/me/appearance')).body?.accent === 'jade');
  const stealName = await bob.patch('/profile/me', { username });
  check('a taken username cannot be claimed by someone else', stealName.status === 409, `status ${stealName.status}`);

  /* ── Links ──────────────────────────────────────────────────────── */
  section('Links');
  const link1 = await alice.post('/links', { title: 'GitHub', url: 'https://github.com/ada', description: 'Code' });
  const link2 = await alice.post('/links', { title: 'Blog', url: 'https://example.com/blog' });
  const link3 = await alice.post('/links', { title: 'Hidden', url: 'https://example.com/hidden', visible: false });
  check('links created', link1.status === 201 && link2.status === 201 && link3.status === 201, `${link1.status} ${link2.status} ${link3.status}`);
  check('script link rejected', (await alice.post('/links', { title: 'x', url: 'javascript:alert(1)' })).status === 400);
  check('link without title rejected', (await alice.post('/links', { url: 'https://example.com' })).status === 400);

  const id1 = link1.body?._id;
  const id2 = link2.body?._id;
  const id3 = link3.body?._id;

  const renamed = await alice.patch(`/links/${id2}`, { title: 'Engineering blog' });
  check('link updated', renamed.status === 200 && renamed.body?.title === 'Engineering blog');

  const reordered = await alice.put('/links/reorder', { ids: [id2, id1, id3] });
  const ordered = (await alice.get('/links')).body ?? [];
  check('links reordered', reordered.status === 200 && ordered.map((l) => l._id).join() === [id2, id1, id3].join(), ordered.map((l) => l.title).join());

  check('malformed id returns 400, not 500', (await alice.patch('/links/not-an-id', { title: 'x' })).status === 400);
  check('reorder with malformed ids returns 400', (await alice.put('/links/reorder', { ids: ['nope'] })).status === 400);
  check("another user cannot edit someone else's link", (await bob.patch(`/links/${id1}`, { title: 'pwned' })).status === 403);
  check("another user cannot delete someone else's link", (await bob.del(`/links/${id1}`)).status === 403);
  await bob.put('/links/reorder', { ids: [id1, id2] });
  check("another user's reorder does not touch someone else's links", ((await alice.get('/links')).body ?? []).map((l) => l._id).join() === [id2, id1, id3].join());

  const pubLinks = (await visitor.get(`/links/public/${username}`)).body ?? [];
  check('public links are in the saved order', pubLinks.map((l) => l.title).join() === 'Engineering blog,GitHub', pubLinks.map((l) => l.title).join());
  check('hidden links are not public', !pubLinks.some((l) => l.title === 'Hidden'));
  check('public links expose no click counts or owner ids', !/clicks|userId/.test(JSON.stringify(pubLinks)));

  const toggled = await alice.patch(`/links/${id1}`, { enabled: false });
  check('a disabled link leaves the public profile', toggled.status === 200 && !((await visitor.get(`/links/public/${username}`)).body ?? []).some((l) => l.id === id1));
  await alice.patch(`/links/${id1}`, { enabled: true });

  /* ── Projects ───────────────────────────────────────────────────── */
  section('Projects');
  const proj1 = await alice.post('/projects', { name: 'Engine', description: 'A thing', tech: ['TypeScript'], repoUrl: 'https://github.com/ada/engine' });
  const proj2 = await alice.post('/projects', { name: 'Loom', tech: ['Rust'] });
  check('projects created', proj1.status === 201 && proj2.status === 201, `${proj1.status} ${proj2.status}`);
  check('first project is featured automatically', proj1.body?.featured === true && proj2.body?.featured === false);
  const p1 = proj1.body?._id;
  const p2 = proj2.body?._id;

  const feat = await alice.patch(`/projects/${p2}/feature`, { featured: true });
  const afterFeat = (await alice.get('/projects')).body ?? [];
  check('featuring one project unfeatures the other', feat.status === 200 && afterFeat.find((p) => p._id === p2)?.featured === true && afterFeat.find((p) => p._id === p1)?.featured === false);
  check('feature flag must be a boolean', (await alice.patch(`/projects/${p2}/feature`, { featured: 'yes' })).status === 400);

  const projUpdate = await alice.patch(`/projects/${p1}`, { status: 'beta', liveUrl: 'https://engine.example.com' });
  check('project updated', projUpdate.body?.status === 'beta' && projUpdate.body?.liveUrl === 'https://engine.example.com');
  const projClear = await alice.patch(`/projects/${p1}`, { liveUrl: '' });
  check('project URL can be cleared', projClear.status === 200 && !projClear.body?.liveUrl, brief(projClear.body));

  await alice.put('/projects/reorder', { ids: [p2, p1] });
  check('projects reordered', ((await alice.get('/projects')).body ?? []).map((p) => p._id).join() === [p2, p1].join());

  await alice.patch(`/projects/${p1}`, { visible: false });
  const pubProjects = (await visitor.get(`/projects/public/${username}`)).body ?? [];
  check('hidden project is not public', pubProjects.length === 1 && pubProjects[0].name === 'Loom', brief(pubProjects));
  await alice.patch(`/projects/${p1}`, { visible: true });
  check("another user cannot edit someone else's project", (await bob.patch(`/projects/${p1}`, { name: 'pwned' })).status === 403);

  /* ── Components ─────────────────────────────────────────────────── */
  section('Components');
  const types = await alice.get('/components/types');
  check('component registry is served', (types.body ?? []).length >= 13, `count ${(types.body ?? []).length}`);

  const about = await alice.post('/components', { type: 'about', config: { content: 'Hello there', highlights: ['Ships fast'] } });
  const contact = await alice.post('/components', { type: 'contact', config: { email: 'ada@example.org' } });
  const skills = await alice.post('/components', { type: 'skills', config: { categories: [{ name: 'Languages', items: ['Rust', 'TypeScript'] }] } });
  check('components created', about.status === 201 && contact.status === 201 && skills.status === 201, `${about.status} ${contact.status} ${skills.status} ${skills.text}`);
  check('defaults are filled in', about.body?.title === 'About Me' && contact.body?.config?.formEnabled === true);

  check('unknown component type rejected', (await alice.post('/components', { type: 'nope' })).status === 400);
  check('script URL in a component rejected', (await alice.post('/components', { type: 'custom_section', config: { ctaUrl: 'javascript:alert(1)' } })).status === 400);
  check('wrong config type rejected', (await alice.post('/components', { type: 'hero', config: { headline: 42 } })).status === 400);

  const cid = about.body?._id;
  const cfg = await alice.patch(`/components/${cid}`, { config: { content: 'Updated bio' } });
  check('component config is merged and saved', cfg.body?.config?.content === 'Updated bio' && cfg.body?.config?.highlights?.[0] === 'Ships fast', brief(cfg.body?.config));

  await alice.put('/components/reorder', { ids: [skills.body?._id, cid, contact.body?._id] });
  const pubComponents = (await visitor.get(`/components/public/${username}`)).body ?? [];
  check('public components follow the saved order', pubComponents.map((c) => c.type).join() === 'skills,about,contact', pubComponents.map((c) => c.type).join());

  await alice.patch(`/components/${contact.body?._id}`, { visible: false });
  check('hidden component is not public', !((await visitor.get(`/components/public/${username}`)).body ?? []).some((c) => c.type === 'contact'));
  await alice.patch(`/components/${contact.body?._id}`, { visible: true });
  check("another user cannot edit someone else's component", (await bob.patch(`/components/${cid}`, { title: 'pwned' })).status === 403);

  const tmp = await alice.post('/components', { type: 'timeline' });
  const removed = await alice.del(`/components/${tmp.body?._id}`);
  check('component removed', removed.status === 200 && !((await alice.get('/components')).body ?? []).some((c) => c._id === tmp.body?._id));

  /* ── Analytics ──────────────────────────────────────────────────── */
  section('Analytics');
  const emptyReport = (await alice.get('/analytics?range=7d')).body ?? {};
  check('a new profile reports zero, not sample data', emptyReport.summary?.views === 0 && emptyReport.summary?.clicks === 0 && (emptyReport.topLinks ?? []).length === 0, brief(emptyReport.summary));

  const view = await visitor.post('/analytics/track', { profileUsername: username, referrer: 'https://news.ycombinator.com/item?id=1' });
  check('profile view accepted', view.status === 204, `status ${view.status}`);
  await visitor.post('/analytics/track', { profileUsername: username });
  await alice.post('/analytics/track', { profileUsername: username });
  await makeClient('curl/8.0').post('/analytics/track', { profileUsername: username });
  await makeClient(BROWSER_UA).post('/analytics/track', { profileUsername: username, referrer: 'https://github.com/ada' });

  const click = await visitor.post(`/links/${id1}/click`);
  check('link click accepted', click.status === 200 && click.body?.url === 'https://github.com/ada', brief(click.body));
  await visitor.post(`/links/${id1}/click`);
  await alice.post(`/links/${id1}/click`);
  const hiddenClick = await visitor.post(`/links/${id3}/click`);
  check('a hidden link cannot be clicked', hiddenClick.status === 404, `status ${hiddenClick.status}`);
  check('a missing link returns 404', (await visitor.post(`/links/${FAKE_ID}/click`)).status === 404);
  const projectClick = await visitor.post(`/projects/${p2}/click`);
  check('project click accepted', projectClick.status === 200);

  const report = (await alice.get('/analytics?range=7d')).body ?? {};
  check('views are counted once per visitor (repeat, owner and bot ignored)', report.summary?.views === 2, brief(report.summary));
  check('link clicks are de-duplicated and exclude the owner', report.summary?.clicks === 1, brief(report.summary));
  check('project clicks are counted', report.summary?.projectClicks === 1, brief(report.summary));
  check('top links use the server-side title', report.topLinks?.[0]?.label === 'GitHub' && report.topLinks?.[0]?.count === 1, brief(report.topLinks));
  check('top projects are reported', report.topProjects?.[0]?.label === 'Loom', brief(report.topProjects));
  check('referrers are reported by domain only', (report.referrers ?? []).some((r) => r.label === 'news.ycombinator.com') && !JSON.stringify(report.referrers).includes('item?id'), brief(report.referrers));
  check('device categories are reported', (report.devices ?? []).some((d) => d.label === 'mobile') && (report.devices ?? []).some((d) => d.label === 'desktop'), brief(report.devices));
  check('daily series covers the range', (report.viewsSeries ?? []).length === 7 && report.viewsSeries.at(-1)?.value === 2, brief(report.viewsSeries?.slice(-2)));
  check('no change is invented without a previous period', report.change?.views === null, brief(report.change));
  check('the report holds no visitor identifiers', !/fingerprint|127\.0\.0\.1|Mozilla/.test(JSON.stringify(report)));

  const linkAfter = ((await alice.get('/links')).body ?? []).find((l) => l._id === id1);
  check('the link click counter matches', linkAfter?.clicks === 1, `clicks ${linkAfter?.clicks}`);

  check('analytics requires authentication', (await visitor.get('/analytics')).status === 401);
  const bobReport = (await bob.get('/analytics?range=7d')).body ?? {};
  check("another user's report does not include these events", bobReport.summary?.views === 0 && bobReport.summary?.clicks === 0, brief(bobReport.summary));
  const ghostTrack = await visitor.post('/analytics/track', { profileUsername: 'does_not_exist_zz' });
  check('tracking an unknown profile reveals nothing', ghostTrack.status === 204);

  /* ── Media ──────────────────────────────────────────────────────── */
  section(SKIP_R2 ? 'Media (local storage)' : 'Media — Cloudflare R2');
  const upload = await alice.post('/media/upload?type=avatar', fileForm(PNG_BYTES, 'image/png', 'avatar.png'));
  check('avatar upload accepted', upload.status === 201, `status ${upload.status} ${upload.text}`);
  const mediaId = upload.body?._id;
  check('object key is server-generated under the owner', new RegExp(`^profile-picture/${me.body?.user?.id}/[a-f0-9]{24}\\.png$`).test(upload.body?.key ?? ''), upload.body?.key);
  check('media has a stable absolute URL', /^https?:\/\/.+\/api\/v1\/media\/public\/[a-f0-9]{24}$/.test(upload.body?.url ?? ''), upload.body?.url);
  check('upload response exposes no storage credentials', !/X-Amz-Credential|secret/i.test(upload.text));

  const served = await visitor.get(`/media/public/${mediaId}`);
  if (SKIP_R2) {
    check('public media is served', served.status === 200, `status ${served.status}`);
  } else {
    check('public media redirects to a signed R2 URL', served.status === 302 && served.location.includes('r2.cloudflarestorage.com') && served.location.includes('X-Amz-Signature'), `${served.status} ${served.location.slice(0, 90)}`);
    const object = await fetch(served.location);
    const bytes = Buffer.from(await object.arrayBuffer());
    check('the signed URL returns the exact uploaded bytes', object.ok && bytes.equals(PNG_BYTES), `status ${object.status}, ${bytes.length} bytes`);
    check('the object is served with its content type', (object.headers.get('content-type') ?? '').startsWith('image/png'), object.headers.get('content-type'));
    const unsigned = await fetch(served.location.split('?')[0]);
    check('the bucket is private without a signature', !unsigned.ok, `status ${unsigned.status}`);
  }

  const avatarSaved = await alice.patch('/profile/me', { avatarUrl: upload.body?.url });
  check('uploaded image can be set as the profile avatar', avatarSaved.status === 200 && avatarSaved.body?.avatarUrl === upload.body?.url, `status ${avatarSaved.status} ${avatarSaved.text.slice(0, 120)}`);
  check('the avatar shows on the public profile', (await visitor.get(`/profile/${username}`)).body?.avatarUrl === upload.body?.url);

  const upload2 = await alice.post('/media/upload?type=avatar', fileForm(PNG_BYTES, 'image/png', 'avatar-2.png'));
  check('a second avatar upload succeeds', upload2.status === 201, `status ${upload2.status} ${upload2.text}`);
  check('the previous avatar is replaced', (await visitor.get(`/media/public/${mediaId}`)).status === 404);
  const avatarId = upload2.body?._id;

  const list = (await alice.get('/media')).body ?? [];
  check('media list shows only current files', list.some((m) => m._id === avatarId) && !list.some((m) => m._id === mediaId));
  const one = await alice.get(`/media/${avatarId}`);
  check('owner can read metadata', one.status === 200 && one.body?.mimeType === 'image/png' && one.body?.sizeBytes === PNG_BYTES.length && typeof one.body?.downloadUrl === 'string', brief(one.body));

  check("another user cannot read someone else's media record", (await bob.get(`/media/${avatarId}`)).status === 403);
  check("another user cannot delete someone else's media", (await bob.del(`/media/${avatarId}`)).status === 403);
  check("another user cannot change someone else's media", (await bob.patch(`/media/${avatarId}`, { visibility: 'private' })).status === 403);
  check('media list requires authentication', (await visitor.get('/media')).status === 401);
  check('upload requires authentication', (await visitor.post('/media/upload?type=avatar', fileForm(PNG_BYTES, 'image/png', 'a.png'))).status === 401);

  section('Media — validation');
  check('executable disguised as PNG rejected', (await alice.post('/media/upload?type=avatar', fileForm(Buffer.from('MZ\u0000\u0000fake exe'), 'image/png', 'evil.png'))).status === 400);
  check('mismatched extension rejected', (await alice.post('/media/upload?type=avatar', fileForm(PNG_BYTES, 'image/png', 'payload.exe'))).status === 400);
  check('wrong type for the category rejected', (await alice.post('/media/upload?type=avatar', fileForm(PDF_BYTES, 'application/pdf', 'doc.pdf'))).status === 400);
  check('SVG rejected', (await alice.post('/media/upload?type=project', fileForm(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'image/svg+xml', 'x.svg'))).status === 400);
  check('unknown category rejected', (await alice.post('/media/upload?type=../../etc', fileForm(PNG_BYTES, 'image/png', 'a.png'))).status === 400);
  check('missing file rejected', (await alice.post('/media/upload?type=avatar', new FormData())).status === 400);
  const oversized = await alice.post('/media/upload?type=avatar', fileForm(Buffer.concat([PNG_BYTES, Buffer.alloc(6 * 1024 * 1024)]), 'image/png', 'big.png'));
  check('oversized file rejected', oversized.status === 400 || oversized.status === 413, `status ${oversized.status}`);

  section('Media — private files');
  const resume = await alice.post('/media/upload?type=resume', fileForm(PDF_BYTES, 'application/pdf', 'cv.pdf'));
  check('resume upload accepted', resume.status === 201 && resume.body?.visibility === 'private', `status ${resume.status} ${resume.text.slice(0, 120)}`);
  const resumeId = resume.body?._id;
  check('a private file is not reachable publicly', (await visitor.get(`/media/public/${resumeId}`)).status === 404);
  const ownerDl = await alice.get(`/media/${resumeId}/download`);
  check('the owner can download their private file', ownerDl.status === 302 || ownerDl.status === 200, `status ${ownerDl.status}`);
  check('another user cannot download it', (await bob.get(`/media/${resumeId}/download`)).status === 403);
  check('a visitor cannot download it', (await visitor.get(`/media/${resumeId}/download`)).status === 401);
  const madePublic = await alice.patch(`/media/${resumeId}`, { visibility: 'public' });
  const nowPublic = await visitor.get(`/media/public/${resumeId}`);
  check('the owner can make a file public', madePublic.body?.visibility === 'public' && (nowPublic.status === 302 || nowPublic.status === 200), `${madePublic.status} ${nowPublic.status}`);

  if (!SKIP_R2) {
    section('Media — direct-to-R2 upload');
    const signed = await alice.post('/media/signed-upload', { type: 'project', filename: 'shot.png', mimeType: 'image/png', sizeBytes: PNG_BYTES.length });
    check('presigned upload URL issued', signed.status === 201 && String(signed.body?.uploadUrl ?? '').startsWith('https://'), `status ${signed.status} ${signed.text.slice(0, 120)}`);
    check('an unconfirmed upload is not served', (await visitor.get(`/media/public/${signed.body?.mediaId}`)).status === 404);
    check('completing before uploading fails', (await alice.post(`/media/${signed.body?.mediaId}/complete`)).status === 400);

    const put = await fetch(signed.body.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: PNG_BYTES });
    check('direct PUT to R2 succeeds', put.ok, `status ${put.status} ${(await put.text()).slice(0, 160)}`);
    check("another user cannot confirm someone else's upload", (await bob.post(`/media/${signed.body?.mediaId}/complete`)).status === 403);
    const complete = await alice.post(`/media/${signed.body?.mediaId}/complete`);
    check('upload verified and confirmed', complete.status === 200 && complete.body?.referenced === true && complete.body?.sizeBytes === PNG_BYTES.length, `status ${complete.status} ${complete.text.slice(0, 160)}`);
    check('the confirmed upload is served', (await visitor.get(`/media/public/${signed.body?.mediaId}`)).status === 302);

    const wrongType = await fetch(signed.body.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'text/html' }, body: '<html></html>' });
    check('the signed URL cannot be reused with another content type', !wrongType.ok, `status ${wrongType.status}`);

    const fake = await alice.post('/media/signed-upload', { type: 'project', filename: 'fake.png', mimeType: 'image/png', sizeBytes: 20 });
    await fetch(fake.body.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: Buffer.from('MZ\u0000\u0000not a png at all') });
    const fakeComplete = await alice.post(`/media/${fake.body?.mediaId}/complete`);
    check('a direct upload with fake content is rejected', fakeComplete.status === 400, `status ${fakeComplete.status}`);
    check('the rejected upload is removed', (await alice.get(`/media/${fake.body?.mediaId}`)).status === 404);

    const delSigned = await alice.del(`/media/${signed.body?.mediaId}`);
    check('media deleted', delSigned.status === 200);
    const goneFromBucket = await fetch((await visitor.get(`/media/public/${signed.body?.mediaId}`)).location || 'http://127.0.0.1:1/').catch(() => ({ ok: false }));
    check('deleted media is gone from the API and the bucket', (await alice.get(`/media/${signed.body?.mediaId}`)).status === 404 && !goneFromBucket.ok);
  }

  /* ── Templates ──────────────────────────────────────────────────── */
  section('Templates');
  const tpl = await alice.post('/templates/from-profile', { name: `Jade ${suffix}`, description: 'Green and wide', tags: ['Dark', 'minimal'] });
  check('template created from profile', tpl.status === 201 && tpl.body?.appearance?.accent === 'jade' && (tpl.body?.components ?? []).length === 3, `status ${tpl.status} ${tpl.text.slice(0, 160)}`);
  const tplId = tpl.body?._id;
  check('template keeps the look but no personal content', !/Updated bio|ada@example\.org|Ships fast|Rust/.test(JSON.stringify(tpl.body)), brief(tpl.body?.components));
  check('template response does not expose the creator id', !tpl.text.includes(me.body?.user?.id ?? 'x'));
  check('a new template starts private', tpl.body?.published === false);

  check('a private template is not discoverable', !((await bob.get('/templates')).body ?? []).some((t) => t._id === tplId));
  check("another user cannot preview someone else's private template", (await bob.get(`/templates/${tplId}`)).status === 404);
  check("another user cannot apply someone else's private template", (await bob.post(`/templates/${tplId}/apply`)).status === 404);
  check("another user cannot duplicate someone else's private template", (await bob.post(`/templates/${tplId}/duplicate`)).status === 404);
  check("another user cannot edit someone else's template", [403, 404].includes((await bob.patch(`/templates/${tplId}`, { name: 'pwned' })).status));
  check("another user cannot delete someone else's template", [403, 404].includes((await bob.del(`/templates/${tplId}`)).status));

  const publishedTpl = await alice.post(`/templates/${tplId}/publish`);
  check('template published', publishedTpl.body?.published === true, brief(publishedTpl.body));
  check('a published template is discoverable', ((await visitor.get('/templates')).body ?? []).some((t) => t._id === tplId));
  check('discovery can filter by tag', ((await visitor.get('/templates?tag=minimal')).body ?? []).some((t) => t._id === tplId) && !((await visitor.get('/templates?tag=nonexistent')).body ?? []).some((t) => t._id === tplId));
  const preview = await visitor.get(`/templates/${tplId}`);
  check('preview data is available for a published template', preview.status === 200 && preview.body?.appearance?.canvas?.width === 'wide' && preview.body?.isOwner === false);

  const bobAbout = await bob.post('/components', { type: 'about', config: { content: 'Bob wrote this' } });
  const applied = await bob.post(`/templates/${tplId}/apply`);
  check('use template succeeds', applied.status === 200 && applied.body?.appliedComponents === 2 && applied.body?.skippedComponents === 1, brief(applied.body));
  const bobLook = (await bob.get('/profile/me/appearance')).body ?? {};
  check("the template's look is cloned into the profile", bobLook.accent === 'jade' && bobLook.canvas?.width === 'wide' && bobLook.surface?.opacity === 42, brief(bobLook));
  const bobComponents = (await bob.get('/components')).body ?? [];
  check('missing component types are added', bobComponents.map((c) => c.type).sort().join() === 'about,contact,skills', bobComponents.map((c) => c.type).join());
  check('existing content is not overwritten', bobComponents.find((c) => c._id === bobAbout.body?._id)?.config?.content === 'Bob wrote this');

  const appliedAgain = await bob.post(`/templates/${tplId}/apply`);
  check('applying twice creates no duplicates', appliedAgain.body?.appliedComponents === 0 && ((await bob.get('/components')).body ?? []).length === 3, brief(appliedAgain.body));

  await alice.patch(`/templates/${tplId}`, { appearance: { accent: 'rose' } });
  check('editing the template later does not change profiles that used it', (await bob.get('/profile/me/appearance')).body?.accent === 'jade');
  check('applying a template does not change the template owner', (await alice.get('/profile/me/appearance')).body?.accent === 'jade');

  const dup = await bob.post(`/templates/${tplId}/duplicate`);
  check('a published template can be duplicated', dup.status === 201 && dup.body?.isOwner === true && dup.body?.published === false && dup.body?._id !== tplId, `status ${dup.status} ${dup.text.slice(0, 140)}`);
  check('the copy is independent', (await bob.patch(`/templates/${dup.body?._id}`, { name: `Bob copy ${suffix}` })).status === 200 && (await alice.get(`/templates/${tplId}`)).body?.name === `Jade ${suffix}`);
  check("own templates are listed under 'mine'", ((await bob.get('/templates/mine')).body ?? []).length === 1);

  await alice.post(`/templates/${tplId}/unpublish`);
  check('an unpublished template disappears from discovery', !((await visitor.get('/templates')).body ?? []).some((t) => t._id === tplId) && (await visitor.get(`/templates/${tplId}`)).status === 404);
  check('invalid component in a template is rejected', (await alice.post('/templates', { name: 'Bad', components: [{ type: 'custom_section', title: 'x', config: { ctaUrl: 'javascript:alert(1)' } }] })).status === 400);
  check('template deleted', (await alice.del(`/templates/${tplId}`)).status === 200 && (await alice.get(`/templates/${tplId}`)).status === 404);

  /* ── Integrations ───────────────────────────────────────────────── */
  section('Integrations');
  const catalog = (await visitor.get('/integrations/providers')).body?.providers ?? [];
  check('provider catalogue lists every supported provider', ['github', 'discord', 'spotify', 'wakatime', 'leetcode', 'codechef', 'hackerrank'].every((id) => catalog.some((p) => p.id === id)), catalog.map((p) => p.id).join());
  const integrationGithub = catalog.find((p) => p.id === 'github')?.configured === true;
  console.log(`        configured: ${catalog.filter((p) => p.configured).map((p) => p.id).join(', ')}`);

  check('integrations require authentication', (await visitor.get('/integrations')).status === 401);
  check('nothing is connected at first', ((await alice.get('/integrations')).body ?? []).length === 0);

  const leet = await alice.post('/integrations/connect', { integrationId: 'leetcode', handle: 'ada_lovelace' });
  check('manual profile linked', leet.status === 201 && leet.body?.handle === '@ada_lovelace' && leet.body?.profileUrl === 'https://leetcode.com/u/ada_lovelace/', `status ${leet.status} ${leet.text.slice(0, 160)}`);
  check('a manual link is marked unverified and carries no data', leet.body?.verified === false && Object.keys(leet.body?.data ?? {}).length === 0);
  check('invalid manual username rejected', (await alice.post('/integrations/connect', { integrationId: 'hackerrank', handle: 'bad name!' })).status === 400);
  check('an OAuth provider cannot be faked with a typed-in handle', (await alice.post('/integrations/connect', { integrationId: 'github', handle: '@torvalds' })).status === 400);
  check('unknown provider rejected', (await alice.post('/integrations/connect', { integrationId: 'myspace', handle: 'ada' })).status === 404);
  check('extra fields are rejected', (await alice.post('/integrations/connect', { integrationId: 'leetcode', handle: 'ada', metadata: { verified: true } })).status === 400);

  const badKey = await alice.post('/integrations/connect', { integrationId: 'wakatime', apiKey: 'INVALID_WAKATIME_KEY_FOR_TESTING' });
  check('an invalid WakaTime key is rejected by the real API', badKey.status === 400 || badKey.status === 502, `status ${badKey.status} ${badKey.text.slice(0, 120)}`);
  check('a rejected key is not stored', !((await alice.get('/integrations')).body ?? []).some((i) => i.integrationId === 'wakatime'));

  const mine = await alice.get('/integrations');
  check('owner list never contains credentials', !/accessToken|refreshToken|apiKey/i.test(mine.text), mine.text.slice(0, 160));
  const pubIntegrations = await visitor.get(`/integrations/public/${username}`);
  check('connected integration shows on the public profile', (pubIntegrations.body ?? []).some((i) => i.integrationId === 'leetcode' && i.verified === false), brief(pubIntegrations.body));
  check('public integrations expose no ids or credentials', !/_id|userId|accessToken|refreshToken|externalId/.test(pubIntegrations.text));
  check("another user's integrations are separate", ((await bob.get('/integrations')).body ?? []).length === 0);

  const syncManual = await alice.post('/integrations/leetcode/sync');
  check('syncing a manual link is a harmless no-op', syncManual.status === 200 && syncManual.body?.status === 'connected');
  check('syncing something not connected returns 404', (await alice.post('/integrations/spotify/sync')).status === 404);

  const startAnon = await visitor.get('/integrations/oauth/github/start');
  check('starting a connection requires a session', startAnon.status === 302 && startAnon.location.includes('error=login_required'), startAnon.location.slice(0, 120));

  if (integrationGithub) {
    const start = await alice.get('/integrations/oauth/github/start');
    const url = new URL(start.location);
    check('GitHub connection redirects to GitHub', start.status === 302 && url.origin === 'https://github.com' && url.pathname === '/login/oauth/authorize', start.location.slice(0, 80));
    check('the request carries state and a PKCE challenge', Boolean(url.searchParams.get('state')) && url.searchParams.get('code_challenge_method') === 'S256' && (url.searchParams.get('code_challenge') ?? '').length >= 43);
    check('the integration asks only for public profile access', url.searchParams.get('scope') === 'read:user', url.searchParams.get('scope'));
    check('the client secret never appears in the redirect', !start.location.includes('client_secret'));
    check('the redirect URI is the server-configured callback', (url.searchParams.get('redirect_uri') ?? '').endsWith('/api/v1/auth/github/callback'), url.searchParams.get('redirect_uri'));

    const state = url.searchParams.get('state');
    const stolenState = await bob.get(`/auth/github/callback?code=abc&state=${encodeURIComponent(state)}`);
    check("a state from one user's browser is useless in another's", stolenState.status === 302 && stolenState.location.includes('error=oauth_state_invalid'), stolenState.location.slice(0, 140));

    const bogus = await alice.get(`/auth/github/callback?code=not-a-real-code&state=${encodeURIComponent(state)}`);
    check('a bogus code fails at GitHub and reports back to the integrations page', bogus.status === 302 && bogus.location.includes('/dashboard/integrations') && bogus.location.includes('error=integration_connect_failed'), bogus.location.slice(0, 160));
    check('a failed connection stores nothing', !((await alice.get('/integrations')).body ?? []).some((i) => i.integrationId === 'github'));
    const replay = await alice.get(`/auth/github/callback?code=abc&state=${encodeURIComponent(state)}`);
    check('a state cannot be replayed', replay.status === 302 && replay.location.includes('error=oauth_state_invalid'), replay.location.slice(0, 140));
  }

  const unconfigured = catalog.find((p) => p.kind === 'oauth' && !p.configured);
  if (unconfigured) {
    const res = await alice.get(`/integrations/oauth/${unconfigured.id}/start`);
    check(`an unconfigured provider (${unconfigured.id}) reports that instead of failing`, res.status === 302 && res.location.includes('error=integration_not_available'), res.location.slice(0, 140));
  }
  const forgedIntegration = await alice.get('/integrations/oauth/discord/callback?code=abc&state=forged');
  check('a forged integration callback is rejected', forgedIntegration.status === 302 && forgedIntegration.location.includes('error=integration_state_invalid'), forgedIntegration.location.slice(0, 140));

  const disconnected = await alice.del('/integrations/leetcode');
  check('integration disconnected', disconnected.status === 200 && disconnected.body?.status === 'disconnected' && !disconnected.body?.handle, brief(disconnected.body));
  check('a disconnected integration leaves the public profile', ((await visitor.get(`/integrations/public/${username}`)).body ?? []).length === 0);
  check('disconnecting something never connected returns 404', (await alice.del('/integrations/codechef')).status === 404);

  /* ── OAuth sign-in ──────────────────────────────────────────────── */
  section('OAuth sign-in');
  if (githubConfigured) {
    const oauth = makeClient();
    const start = await oauth.get('/auth/github');
    const url = new URL(start.location);
    check('GET /auth/github redirects to GitHub', start.status === 302 && url.origin === 'https://github.com');
    check('sign-in uses state + PKCE', Boolean(url.searchParams.get('state')) && url.searchParams.get('code_challenge_method') === 'S256');
    check('sign-in never exposes the client secret', !start.location.includes('client_secret'));
    check('forged state is rejected', (await oauth.get('/auth/github/callback?code=abc&state=forged')).location.includes('error=oauth_state_invalid'));
    check('missing code is rejected', (await makeClient().get('/auth/github/callback?state=whatever')).location.includes('error=oauth_missing_code'));
    check('denied authorization is handled', (await makeClient().get('/auth/github/callback?error=access_denied')).location.includes('error=oauth_denied'));
    const noSession = await makeClient().get(`/auth/github/callback?code=abc&state=${encodeURIComponent(url.searchParams.get('state'))}`);
    check('a valid state without the matching session is rejected', noSession.location.includes('error=oauth_state_invalid'));
    check('error redirects only ever go to the configured frontend', new URL(noSession.location).pathname === '/login');
  }
  if (googleConfigured) {
    const start = await makeClient().get('/auth/google');
    const url = new URL(start.location);
    check('GET /auth/google redirects to Google', start.status === 302 && url.origin === 'https://accounts.google.com');
    check('Google sign-in is OpenID Connect with nonce + PKCE', (url.searchParams.get('scope') ?? '').includes('openid') && Boolean(url.searchParams.get('nonce')) && url.searchParams.get('code_challenge_method') === 'S256');
  }
  const linkAnon = await makeClient().get('/auth/github?mode=link');
  check('account linking requires being signed in', linkAnon.status === 302 && (linkAnon.location.includes('error=oauth_login_required') || linkAnon.location.includes('error=oauth_not_configured')), linkAnon.location.slice(0, 120));
  check('unlinking a provider that is not linked returns 404', (await alice.del('/auth/identities/github')).status === 404);

  /* ── Ghost mode ─────────────────────────────────────────────────── */
  section('Ghost mode');
  const ghostOn = await alice.patch('/profile/me', { ghostMode: true });
  check('ghost mode can be enabled', ghostOn.body?.ghostMode === true);
  check('a ghosted profile looks like a missing one', (await visitor.get(`/profile/${username}`)).body === null && (await visitor.get(`/profile/no_such_user_${suffix}`)).body === null);
  check('a ghosted profile exposes no links', (await visitor.get(`/links/public/${username}`)).status === 404);
  check('a ghosted profile exposes no projects', (await visitor.get(`/projects/public/${username}`)).status === 404);
  check('a ghosted profile exposes no components', (await visitor.get(`/components/public/${username}`)).status === 404);
  check('a ghosted profile exposes no integrations', (await visitor.get(`/integrations/public/${username}`)).status === 404);
  check('links of a ghosted profile cannot be clicked', (await visitor.post(`/links/${id2}/click`)).status === 404);
  check('the owner keeps full access while ghosted', (await alice.get('/profile/me')).body?.username === username && ((await alice.get('/links')).body ?? []).length === 3);
  await alice.patch('/profile/me', { ghostMode: false });
  check('the profile is public again afterwards', (await visitor.get(`/profile/${username}`)).body?.username === username);

  const unpublished = await alice.post('/profile/me/unpublish');
  check('profile can be unpublished', unpublished.body?.live === false && (await visitor.get(`/profile/${username}`)).body === null);
  await alice.post('/profile/me/publish');

  /* ── Persistence, export & password ─────────────────────────────── */
  section('Activity log, export & password');
  const log = (await alice.get('/changelog?limit=100')).body ?? [];
  check('changes are recorded in the activity log', ['profile.published', 'appearance.updated', 'link.created', 'project.created', 'component.created', 'media.uploaded', 'integration.connected'].every((a) => log.some((e) => e.action === a)), [...new Set(log.map((e) => e.action))].join());
  check("another user's activity log is separate", !((await bob.get('/changelog?limit=100')).body ?? []).some((e) => e.action === 'link.created'));

  const exported = await alice.get('/auth/export');
  check('data export contains the account data', exported.body?.account?.email === email && (exported.body?.links ?? []).length === 3 && (exported.body?.projects ?? []).length === 2);
  check('data export contains no secrets', !/passwordHash|accessToken|refreshToken/.test(exported.text));

  const second = makeClient();
  await second.post('/auth/login', { email, password });
  const wrongCurrent = await alice.patch('/auth/password', { currentPassword: 'nope-nope', newPassword: 'another-secret-2' });
  check('password change needs the current password', wrongCurrent.status === 400, `status ${wrongCurrent.status}`);
  const changed = await alice.patch('/auth/password', { currentPassword: password, newPassword: 'another-secret-2' });
  check('password changed', changed.status === 200);
  check('a password change signs other devices out', (await second.get('/auth/me')).status === 401);
  check('the old password stops working', (await makeClient().post('/auth/login', { email, password })).status === 401);
  check('the new password works', (await makeClient().post('/auth/login', { email, password: 'another-secret-2' })).status === 200);

  const loggedOut = makeClient();
  await loggedOut.post('/auth/login', { email, password: 'another-secret-2' });
  const cookieBeforeLogout = loggedOut.jar.get('stackly.sid');
  await loggedOut.post('/auth/logout');
  loggedOut.jar.set('stackly.sid', cookieBeforeLogout);
  check('a session is unusable after logout', (await loggedOut.get('/auth/me')).status === 401);

  /* ── Account deletion ───────────────────────────────────────────── */
  section('Account deletion');
  const bobMedia = await bob.post('/media/upload?type=gallery', fileForm(PNG_BYTES, 'image/png', 'pic.png'));
  await bob.post('/profile/me/publish');
  const bobServed = await visitor.get(`/media/public/${bobMedia.body?._id}`);
  const delBob = await bob.del('/auth/account');
  check('account deleted', delBob.status === 200, `status ${delBob.status} ${delBob.text.slice(0, 120)}`);
  check('the session ends with the account', (await bob.get('/auth/me')).status === 401);
  check('the profile is gone', (await visitor.get(`/profile/${bobUsername}`)).body === null);
  check('the username is free again', (await visitor.get(`/profile/availability/${bobUsername}`)).body?.available === true);
  check('login no longer works', (await makeClient().post('/auth/login', { email: bobEmail, password })).status === 401);
  check('stored media is gone', (await visitor.get(`/media/public/${bobMedia.body?._id}`)).status === 404);
  if (!SKIP_R2 && bobServed.location) {
    const orphan = await fetch(bobServed.location);
    check('the object is removed from the bucket', !orphan.ok, `status ${orphan.status}`);
  }
  check("deleting one account leaves others intact", (await alice.get('/profile/me')).body?.username === username && ((await alice.get('/links')).body ?? []).length === 3);

  const delAlice = await alice.del('/auth/account');
  check('test account cleaned up', delAlice.status === 200);

  /* ── Summary ────────────────────────────────────────────────────── */
  console.log(`\n${'='.repeat(60)}`);
  console.log(`PASSED: ${pass}   FAILED: ${fail}`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  - ${f}`);
  }
  console.log('='.repeat(60));

  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('SMOKE TEST CRASHED:', err);
  process.exit(1);
});
