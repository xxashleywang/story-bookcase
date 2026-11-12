function typescriptFallback(specifier) {
  if (specifier.endsWith('.js')) return `${specifier.slice(0, -3)}.ts`;
  if (!/\.[a-z0-9]+$/i.test(specifier)) return `${specifier}.ts`;
  return null;
}

/** Lets node --test import the server's extensionless TypeScript specifiers. */
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const fallback = error && error.code === 'ERR_MODULE_NOT_FOUND' ? typescriptFallback(specifier) : null;
    if (!fallback) throw error;
    return nextResolve(fallback, context);
  }
}
