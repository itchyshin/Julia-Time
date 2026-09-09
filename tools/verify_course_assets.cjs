"use strict";

const fs = require("node:fs");
const path = require("node:path");

const repositoryRoot = path.resolve(__dirname, "..");

function extractHtmlImageReferences(html) {
  const references = [];
  const renderedHtml = stripInertMarkup(html);
  const tagPattern = /<(img|source)\b[^>]*>/gi;
  for (const tag of renderedHtml.matchAll(tagPattern)) {
    const attributes = tag[0];
    const src = readAttribute(attributes, "src");
    if (src !== null) references.push(src);

    const srcset = readAttribute(attributes, "srcset");
    if (srcset !== null) references.push(...parseSrcset(srcset));
  }
  return references;
}

function stripInertMarkup(html) {
  return String(html)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "");
}

function assertNoRewritingBaseUrl(html, context) {
  const basePattern = /<base\b[^>]*>/gi;
  for (const tag of stripInertMarkup(html).matchAll(basePattern)) {
    const href = readAttribute(tag[0], "href");
    if (href !== null) {
      throw new Error(`${context}: <base href="${href}"> is not allowed because course image addresses must remain explicit and local`);
    }
  }
}

function extractManifestAssetReferences(markdown) {
  const references = [];
  const codeSpanPattern = /`([^`\r\n]+)`/g;
  for (const match of markdown.matchAll(codeSpanPattern)) {
    const reference = match[1].trim();
    if (reference.startsWith("web/")) references.push(reference);
  }
  return references;
}

function findHtmlFiles(webRoot) {
  const files = [];
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, {withFileTypes:true})) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) {
        files.push(fullPath);
      }
    }
  };
  visit(webRoot);
  return files.sort();
}

function auditCourseAssets({
  webRoot = path.join(repositoryRoot, "web"),
  manifestPath = path.join(repositoryRoot, "docs", "design", "course-art-manifest.md")
} = {}) {
  const resolvedWebRoot = path.resolve(webRoot);
  assertDirectory(resolvedWebRoot, "web root");
  const realWebRoot = fs.realpathSync(resolvedWebRoot);
  const assets = [];

  for (const htmlPath of findHtmlFiles(resolvedWebRoot)) {
    const html = fs.readFileSync(htmlPath, "utf8");
    const context = `HTML image in ${path.relative(resolvedWebRoot, htmlPath)}`;
    assertNoRewritingBaseUrl(html, context);
    for (const source of extractHtmlImageReferences(html)) {
      const assetPath = resolveLocalAsset({
        source,
        baseDirectory:path.dirname(htmlPath),
        webRoot:resolvedWebRoot,
        realWebRoot,
        context
      });
      assets.push({origin:"html", source, path:assetPath});
    }
  }

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Course art manifest does not exist: ${manifestPath}`);
  }
  const manifest = fs.readFileSync(manifestPath, "utf8");
  for (const source of extractManifestAssetReferences(manifest)) {
    const assetPath = resolveLocalAsset({
      source,
      baseDirectory:resolvedWebRoot,
      webRoot:resolvedWebRoot,
      realWebRoot,
      stripWebPrefix:true,
      context:"course art manifest"
    });
    assets.push({origin:"manifest", source, path:assetPath});
  }

  return {assets};
}

function readAttribute(attributes, name) {
  const expression = new RegExp("(?:^|\\s)" + name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s\"'=<>\\x60]+))", "i");
  const match = attributes.match(expression);
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3];
}

function parseSrcset(srcset) {
  return srcset
    .split(",")
    .map(candidate => candidate.trim().split(/\s+/, 1)[0])
    .filter(Boolean);
}

function resolveLocalAsset({source, baseDirectory, webRoot, realWebRoot, stripWebPrefix = false, context}) {
  const relativeReference = localReference(source, context);
  const relativePath = stripWebPrefix ? stripManifestPrefix(relativeReference, context) : relativeReference;
  const assetPath = path.resolve(baseDirectory, ...relativePath.split("/"));

  if (!isInside(webRoot, assetPath)) {
    throw new Error(`${context}: local asset "${source}" escapes the web root`);
  }
  if (!fs.existsSync(assetPath)) {
    throw new Error(`${context}: local asset "${source}" does not exist at ${assetPath}`);
  }

  const realAssetPath = fs.realpathSync(assetPath);
  if (!isInside(realWebRoot, realAssetPath)) {
    throw new Error(`${context}: local asset "${source}" resolves outside the web root`);
  }

  const stat = fs.statSync(realAssetPath);
  if (!stat.isFile()) {
    throw new Error(`${context}: local asset "${source}" is not a regular file`);
  }
  if (stat.size === 0) {
    throw new Error(`${context}: local asset "${source}" is empty; expected a nonempty file`);
  }
  return realAssetPath;
}

function localReference(source, context) {
  const trimmed = String(source).trim();
  if (!trimmed) throw new Error(`${context}: image source is empty`);
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(trimmed)) {
    throw new Error(`${context}: image source "${source}" is remote or a data URI, not a local asset`);
  }

  const pathWithoutQuery = trimmed.split(/[?#]/, 1)[0];
  if (!pathWithoutQuery) throw new Error(`${context}: image source "${source}" has no local path`);
  let decoded;
  try {
    decoded = decodeURIComponent(pathWithoutQuery);
  } catch {
    throw new Error(`${context}: image source "${source}" is not a valid local path`);
  }
  const normalized = decoded.replace(/\\/g, "/");
  if (normalized.startsWith("/")) {
    throw new Error(`${context}: image source "${source}" must be relative to the local web root`);
  }
  return normalized;
}

function stripManifestPrefix(source, context) {
  if (!source.startsWith("web/")) {
    throw new Error(`${context}: declared asset "${source}" must begin with web/`);
  }
  return source.slice("web/".length);
}

function isInside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function assertDirectory(directory, label) {
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    throw new Error(`${label} is not a directory: ${directory}`);
  }
}

function main() {
  try {
    const result = auditCourseAssets();
    process.stdout.write(`COURSE_ASSETS_OK ${result.assets.length} asset references verified\n`);
  } catch (error) {
    process.stderr.write(`COURSE_ASSETS_ERROR: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  auditCourseAssets,
  extractHtmlImageReferences,
  extractManifestAssetReferences,
  findHtmlFiles
};

if (require.main === module) main();
