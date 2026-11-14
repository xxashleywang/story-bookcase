import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decodeDesign, designConfigFromLocation, encodeDesign, formatPlannerPath, legacyConfigFromHash,
  locationWithoutShare, parsePlannerPath, shareHref, shareReturnPath,
} from '../src/lib/design-url.ts';
import { legacyPageTarget, profilePath, profileTab } from '../src/lib/pages.ts';

const ugly = 't-e2b062-FFFFFFFFFFF~F6F4F0~pale~Laminate~B9A48A';
const factory = 't-e2b062-FFRRBBLLFFR~F6F4F0~pale~Laminate~B9A48A';
const changed = 't-e4e8e7-FFRRBBLLFFR~F6F4F0~pale~Laminate~B9A48A';

test('a design round-trips through a short code and ignores letter case', () => {
  const code = encodeDesign(ugly);
  assert.ok(code);
  assert.ok(code.length < ugly.length);
  assert.equal(code.includes('~'), false);
  assert.equal(decodeDesign(code).toLowerCase(), ugly.toLowerCase());
  assert.equal(encodeDesign(ugly.toLowerCase()), code);
  assert.equal(encodeDesign(decodeDesign(code)), code);
});

test('each design has its own code, including a retired floor name', () => {
  assert.notEqual(encodeDesign(factory), encodeDesign(changed));
  assert.notEqual(encodeDesign(ugly), encodeDesign(ugly.replace('FFFFFFFFFFF', 'FFFFFFFFFFL')));
  const retired = 's-112233-FLBR~abcdef~oak-plank~Carpet~445566';
  assert.equal(decodeDesign(encodeDesign(retired)).toLowerCase(), retired.toLowerCase());
  const custom = 't-aabbcc-FFRRBBLLFFR~010203~custom~Carpet~445566';
  assert.equal(decodeDesign(encodeDesign(custom)).toLowerCase(), custom.toLowerCase());
});

test('a short link opens that design, and an old hash still does', () => {
  const code = encodeDesign(changed);
  assert.equal(legacyConfigFromHash(`#${ugly}`), ugly);
  assert.equal(legacyConfigFromHash('#not-a-design'), null);
  assert.equal(designConfigFromLocation(`/d/${code}`, '', 'stored-design'), decodeDesign(code));
  assert.equal(designConfigFromLocation('/', `#${ugly}`, 'stored-design'), ugly);
  assert.equal(designConfigFromLocation('/', '', 'stored-design'), 'stored-design');
  assert.equal(designConfigFromLocation('/d/not-a-real-code', '', 'stored-design'), '');
});

test('the factory default shares as /, and any other design shares as /d/<code>', () => {
  assert.equal(shareHref('https://imaginemode.apps.grok.bot', '', factory, factory), 'https://imaginemode.apps.grok.bot/');
  assert.equal(shareHref('https://imaginemode.apps.grok.bot', '', factory.toLowerCase(), factory), 'https://imaginemode.apps.grok.bot/');
  const code = encodeDesign(changed);
  assert.equal(shareHref('https://imaginemode.apps.grok.bot', '', changed, factory), `https://imaginemode.apps.grok.bot/d/${code}`);
  assert.equal(shareHref('https://imaginemode.apps.grok.bot', '/preview', changed, factory), `https://imaginemode.apps.grok.bot/preview/d/${code}`);
});

test('planner paths keep the tab, the design, a reference and a one-shot share', () => {
  const code = encodeDesign(changed);
  const shared = { tab: 'build', code, referenceId: 12, share: true };
  assert.equal(formatPlannerPath(shared), `/build-it/d/${code}/from/12/share`);
  assert.deepEqual(parsePlannerPath(`/build-it/d/${code}/from/12/share`), shared);
  assert.equal(parsePlannerPath('/gallery'), null);
  assert.equal(parsePlannerPath('/build/4'), null);
  assert.equal(shareReturnPath('photo', '/my-profile', '', ''), '/gallery/share');
  assert.equal(shareReturnPath('blueprint', '/', '', `#${changed}`), `/d/${code}/share`);
  assert.equal(shareReturnPath('blueprint', '/build-it', '?ref=4', ''), '/build-it/from/4/share');
  assert.equal(locationWithoutShare('', '/gallery/share', '?share=photo', ''), '/gallery');
  assert.equal(locationWithoutShare('', `/d/${code}/share`, '', ''), `/d/${code}`);
  assert.equal(locationWithoutShare('/preview', `/preview/build-it/d/${code}/share`, '?keep=1', ''), `/preview/build-it/d/${code}?keep=1`);
});

test('gallery and profile leave their old addresses', () => {
  assert.equal(legacyPageTarget('/inspiration', ''), '/gallery');
  assert.equal(legacyPageTarget('/inspiration/', '?share=photo'), '/gallery/share');
  assert.equal(legacyPageTarget('/profile', ''), '/my-profile');
  assert.equal(legacyPageTarget('/profile', '?tab=favourites'), '/my-profile/favourites');
  assert.equal(legacyPageTarget('/gallery', ''), null);
  assert.equal(profilePath('uploads'), '/my-profile');
  assert.equal(profilePath('favourites'), '/my-profile/favourites');
  assert.equal(profileTab('/my-profile/favourites'), 'favourites');
  assert.equal(profileTab('/my-profile'), 'uploads');
});
