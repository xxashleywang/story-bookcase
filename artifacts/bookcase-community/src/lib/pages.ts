// Plain addresses for the pages people open on purpose.

export const GALLERY_PATH = '/gallery';
export const GALLERY_SHARE_PATH = '/gallery/share';
export const PROFILE_PATH = '/my-profile';
export const PROFILE_FAVOURITES_PATH = '/my-profile/favourites';

function barePath(pathname: string) {
  const bare = pathname.split(/[?#]/)[0];
  if (bare.length > 1) return bare.replace(/\/+$/, '') || '/';
  return bare || '/';
}

export function profilePath(tab: 'uploads' | 'favourites') {
  return tab === 'favourites' ? PROFILE_FAVOURITES_PATH : PROFILE_PATH;
}

export function profileTab(pathname: string): 'uploads' | 'favourites' {
  return barePath(pathname) === PROFILE_FAVOURITES_PATH ? 'favourites' : 'uploads';
}

/** Old gallery and profile addresses, including the query-string variants, mapped onto the plain paths. */
export function legacyPageTarget(pathname: string, search: string) {
  const path = barePath(pathname);
  const params = new URLSearchParams(search);
  if (path === '/inspiration') return params.get('share') === 'photo' ? GALLERY_SHARE_PATH : GALLERY_PATH;
  if (path === '/profile') return params.get('tab') === 'favourites' ? PROFILE_FAVOURITES_PATH : PROFILE_PATH;
  return null;
}
