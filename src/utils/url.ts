/** 拼接 Astro base 前缀，兼容 GitHub Pages 子路径与 Vercel 根路径部署 */
export function withBase(path: string): string {
  if (!path || path.startsWith("http") || path.startsWith("#") || path.startsWith("mailto:")) {
    return path;
  }

  const base = import.meta.env.BASE_URL;
  if (base === "/") {
    return path.startsWith("/") ? path : `/${path}`;
  }

  const baseWithSlash = base.endsWith("/") ? base : `${base}/`;
  const normalized = path.startsWith("/") ? path.slice(1) : path;
  return `${baseWithSlash}${normalized}`;
}

/** 去掉 base 前缀，用于路由匹配 */
export function stripBase(pathname: string): string {
  const base = import.meta.env.BASE_URL;
  if (base === "/") return pathname || "/";

  const prefix = base.endsWith("/") ? base.slice(0, -1) : base;
  if (pathname === prefix || pathname === `${prefix}/`) return "/";
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length) || "/";
  return pathname;
}

/** 生成绝对 URL，用于 RSS 等场景 */
export function absoluteUrl(path: string): string {
  return new URL(withBase(path), import.meta.env.SITE).href;
}
