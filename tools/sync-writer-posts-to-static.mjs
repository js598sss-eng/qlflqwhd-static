import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const siteDir = process.cwd();
const writerOrigin = "https://wp.qlflqwhd.co.kr";
const bWriterOrigin = "https://wp-a1.qlflqwhd.co.kr";
const publicOrigin = "https://qlflqwhd.co.kr";
const bPublicOrigin = "https://a1.qlflqwhd.co.kr";
const siteName = "qlflqwhd.co.kr";
const adsenseClient = "ca-pub-6459241739499317";
const gaId = "G-DXZ7HY9DF7";

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function stripTags(html) {
  return String(html ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(value) {
  return String(value ?? "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'");
}

function safeSlug(slug, id) {
  return String(slug || `writer-post-${id}`).replace(/^\/+|\/+$/g, "");
}

function normalizedTokens(value) {
  const cleaned = decodeEntities(value)
    .replace(/핵심|정보|간편|안내|요약|CTA|완벽|가이드|신청|방법|총정리|추천|BEST|best|\d+/gi, " ")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .toLowerCase();
  return new Set(cleaned.split(/\s+/).filter((token) => token.length >= 2));
}

function matchBPost(aPost, bPosts) {
  if (!bPosts.length) return null;
  const aTokens = normalizedTokens(`${aPost.title?.rendered || aPost.title?.raw || ""} ${aPost.slug || ""}`);
  let best = null;
  let bestScore = -1;

  for (const bPost of bPosts) {
    const bTokens = normalizedTokens(`${bPost.title?.rendered || bPost.title?.raw || ""} ${bPost.slug || ""}`);
    let score = 0;
    for (const token of aTokens) if (bTokens.has(token)) score += 1;
    const timeGap = Math.abs(new Date(aPost.date || 0) - new Date(bPost.date || 0)) / 60000;
    const adjusted = score - Math.min(timeGap / 120, 2);
    if (adjusted > bestScore) {
      best = bPost;
      bestScore = adjusted;
    }
  }

  return bestScore >= 1 ? best : null;
}

function ctaButtons(targetUrl, title) {
  if (!targetUrl) return "";
  const keyword = decodeEntities(title).replace(/\s*(핵심 정보|간편 안내|요약|완벽 가이드)\s*/g, "").trim();
  const labels = [
    "지금 신청하기 ❯❯",
    `${keyword || "자세히"} 바로 확인 ❯❯`,
    "내 조건 확인 ❯❯",
  ];
  const buttonStyle = "display:block;width:100%;padding:10px 0;margin:0 0 4px 0;background-color:#1f1bc4;color:#ffffff;text-align:center;text-decoration:none;font-family:Verdana,Arial,sans-serif;font-size:18px;font-weight:bold;border-radius:12px;box-sizing:border-box;white-space:nowrap;cursor:pointer";
  return `<div class="a-to-b-cta" style="margin:10px 0">
${labels.map((label) => `<a href="${esc(targetUrl)}" style="${buttonStyle}" rel="noopener">${esc(label)}</a>`).join("")}
</div>`;
}

function rewriteAContent(rawContent, bUrl) {
  let content = String(rawContent || "");
  if (bUrl) {
    content = content.replace(/https:\/\/wp-a1\.qlflqwhd\.co\.kr\/[^"'\s<)]+\/?/g, bUrl);
  }
  return content;
}

function hasExistingCta(rawContent) {
  return /background-color:\s*#1f1bc4/i.test(rawContent) || /wp-a1\.qlflqwhd\.co\.kr/i.test(rawContent);
}

function siteFooter() {
  return `<footer class="site-footer">
    <div class="site-info grid-container">
      <p>해당 웹사이트는 다양한 정보 전달을 목적으로 운영하고 있으며, 어떠한 요구를 하지 않고 판매를 유도하지 않으며 금융 상품 판매 및 중개의 목적이 아닌 정보만 전달합니다. 또한, 어떠한 지적재산권 또한 침해하지 않고 있음을 명시합니다. 공식 홈페이지 및 기관을 통한 내용을 기초로 데이터를 제공하고 있으며 조건 및 내용은 수시로 변경될 수 있어 정확한 정보는 관련 처리기관 홈페이지를 참고하시기 바랍니다.</p>
    </div>
  </footer>`;
}

function pageHtml(post, bPost) {
  const title = decodeEntities(post.title?.rendered || post.title?.raw || `Post ${post.id}`);
  const slug = safeSlug(post.slug, post.id);
  const canonical = `${publicOrigin}/${encodeURI(slug)}/`;
  const bUrl = bPost ? `${bPublicOrigin}/${encodeURI(safeSlug(bPost.slug, bPost.id))}/` : "";
  const originalContent = post.content?.raw || post.content?.rendered || "";
  const rawContent = rewriteAContent(originalContent, bUrl);
  const autoCta = !hasExistingCta(originalContent) ? ctaButtons(bUrl, title) : "";
  const description = stripTags(post.excerpt?.raw || post.excerpt?.rendered || rawContent).slice(0, 155);

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} - ${esc(siteName)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(canonical)}">
  <link rel="stylesheet" href="/assets/style.css">
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}" crossorigin="anonymous"></script>
  <script async src="https://www.googletagmanager.com/gtag/js?id=${gaId}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${gaId}');
  </script>
</head>
<body class="post-template-default single single-post gp-static no-sidebar separate-containers header-aligned-left">
  <main id="content" class="site-main grid-container">
    <article class="post single-post">
      <div class="inside-article">
        <header class="entry-header">
          <h1 class="entry-title">${esc(title)}</h1>
        </header>
        <div class="entry-content">
${autoCta}
          <div class="ad-block ad-top">
            <ins class="adsbygoogle"
                 style="display:block"
                 data-ad-client="${adsenseClient}"
                 data-ad-format="auto"
                 data-full-width-responsive="true"></ins>
            <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
          </div>
${rawContent}
${autoCta}
          <div class="ad-block ad-bottom">
            <ins class="adsbygoogle"
                 style="display:block"
                 data-ad-client="${adsenseClient}"
                 data-ad-format="auto"
                 data-full-width-responsive="true"></ins>
            <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
          </div>
        </div>
      </div>
    </article>
  </main>
${siteFooter()}
</body>
</html>
`;
}

async function fetchPublishedPosts(origin) {
  const url = `${origin}/wp-json/wp/v2/posts/?status=publish&per_page=100`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const posts = await res.json();
  if (!Array.isArray(posts)) throw new Error("Writer posts response is not an array.");
  return posts;
}

async function writePost(post, bPost) {
  const slug = safeSlug(post.slug, post.id);
  const outputDir = path.join(siteDir, slug);
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "index.html"), pageHtml(post, bPost), "utf8");
  return {
    id: post.id,
    title: decodeEntities(post.title?.rendered || post.title?.raw || ""),
    slug,
    url: `${publicOrigin}/${encodeURI(slug)}/`,
    bUrl: bPost ? `${bPublicOrigin}/${encodeURI(safeSlug(bPost.slug, bPost.id))}/` : null,
    modified: post.modified_gmt || post.modified || post.date_gmt || post.date || new Date().toISOString(),
  };
}

async function updateSitemap(entries) {
  const sitemapPath = path.join(siteDir, "sitemap.xml");
  let sitemap = existsSync(sitemapPath)
    ? await readFile(sitemapPath, "utf8")
    : `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n`;

  for (const entry of entries) {
    const lastmod = new Date(entry.modified).toISOString();
    const block = `  <url><loc>${entry.url}</loc><lastmod>${lastmod}</lastmod></url>`;
    const pattern = new RegExp(`\\s*<url><loc>${entry.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</loc>[\\s\\S]*?</url>`, "g");
    sitemap = sitemap.replace(pattern, "");
    sitemap = sitemap.replace("</urlset>", `${block}\n</urlset>`);
  }

  await writeFile(sitemapPath, sitemap, "utf8");
}

async function main() {
  const [posts, bPosts] = await Promise.all([
    fetchPublishedPosts(writerOrigin),
    fetchPublishedPosts(bWriterOrigin).catch(() => []),
  ]);
  const entries = [];
  for (const post of posts) entries.push(await writePost(post, matchBPost(post, bPosts)));
  await updateSitemap(entries);
  console.log(JSON.stringify({ synced: entries.length, entries }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
