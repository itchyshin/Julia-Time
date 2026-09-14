"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..");
const toolPath = path.join(repositoryRoot, "tools", "verify_course_assets.cjs");
const assetTool = fs.existsSync(toolPath) ? require(toolPath) : {};
const checkedInManifestPath = path.join(repositoryRoot, "docs", "design", "course-art-manifest.md");
const checkedInManifestSkip = fs.existsSync(checkedInManifestPath)
  ? false
  : "dev-only material not present in the curated export: docs/design/course-art-manifest.md";

function auditCourseAssets(options) {
  assert.equal(
    typeof assetTool.auditCourseAssets,
    "function",
    "the asset auditor must export auditCourseAssets(options) for focused fixture checks"
  );
  return assetTool.auditCourseAssets(options);
}

function withFixture({html = "", htmlPath = "web/index.html", manifest = "", files = {}}, run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "julia-time-course-assets-"));
  const webRoot = path.join(root, "web");
  const manifestPath = path.join(root, "course-art-manifest.md");
  fs.mkdirSync(webRoot, {recursive:true});
  const fixtureHtmlPath = path.join(root, htmlPath);
  fs.mkdirSync(path.dirname(fixtureHtmlPath), {recursive:true});
  fs.writeFileSync(fixtureHtmlPath, html, "utf8");
  fs.writeFileSync(manifestPath, manifest, "utf8");
  for (const [relativePath, contents] of Object.entries(files)) {
    const fullPath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(fullPath), {recursive:true});
    fs.writeFileSync(fullPath, contents);
  }
  try {
    return run({root, webRoot, manifestPath});
  } finally {
    fs.rmSync(root, {recursive:true, force:true});
  }
}

test("image parser ignores inert markup and does not confuse data-src with src", () => {
  assert.equal(
    typeof assetTool.extractHtmlImageReferences,
    "function",
    "the asset auditor must expose its dependency-free image-reference parser"
  );
  const references = assetTool.extractHtmlImageReferences(
    '<!-- <img src="assets/comment-only.png"> --><script>const markup = "<img src=\\"assets/script-only.png\\">";</script><img data-src="assets/placeholder.png" src="assets/notebook.png"><source src="assets/trays.webp" srcset="assets/trays.webp 1x, assets/trays-2x.webp 2x">'
  );
  assert.deepEqual(references, ["assets/notebook.png", "assets/trays.webp", "assets/trays.webp", "assets/trays-2x.webp"]);
});

test("asset auditor validates the checked-in HTML and manifest references", {skip:checkedInManifestSkip}, () => {
  const result = auditCourseAssets({
    webRoot:path.join(repositoryRoot, "web"),
    manifestPath:path.join(repositoryRoot, "docs", "design", "course-art-manifest.md")
  });
  const sources = result.assets.map(asset => asset.source);
  const origins = new Set(result.assets.map(asset => asset.origin));

  assert.ok(sources.includes("assets/lab-cast.png"));
  assert.ok(sources.includes("assets/course/scene-c2-tray-bench.png"));
  assert.ok(sources.includes("assets/course/scene-c3-handling-desk.png"));
  assert.ok(sources.includes("web/assets/course/detail-c1-field-notebook.png"));
  assert.ok(origins.has("html"));
  assert.ok(origins.has("manifest"));
});

test("asset auditor permits a relative path that remains inside web", () => {
  withFixture({
    html:'<img src="../assets/lab-cast.png">',
    htmlPath:"web/course/index.html",
    files:{"web/assets/lab-cast.png":"a nonempty local asset"}
  }, ({webRoot, manifestPath}) => {
    const result = auditCourseAssets({webRoot, manifestPath});
    assert.equal(result.assets.length, 1);
    assert.equal(result.assets[0].source, "../assets/lab-cast.png");
  });
});

test("asset auditor rejects a missing local image", () => {
  withFixture({html:'<img src="assets/missing.png">'}, ({webRoot, manifestPath}) => {
    assert.throws(
      () => auditCourseAssets({webRoot, manifestPath}),
      /missing|does not exist/i
    );
  });
});

test("asset auditor rejects empty files and non-files", () => {
  withFixture({
    html:'<img src="assets/empty.png">',
    files:{"web/assets/empty.png":""}
  }, ({webRoot, manifestPath}) => {
    assert.throws(
      () => auditCourseAssets({webRoot, manifestPath}),
      /empty|nonempty/i
    );
  });

  withFixture({html:'<img src="assets/not-a-file.png">'}, ({webRoot, manifestPath}) => {
    fs.mkdirSync(path.join(webRoot, "assets", "not-a-file.png"), {recursive:true});
    assert.throws(
      () => auditCourseAssets({webRoot, manifestPath}),
      /regular file|file/i
    );
  });
});

test("asset auditor rejects an image path that escapes web even when the target exists", () => {
  withFixture({
    html:'<img src="../outside.png">',
    files:{"outside.png":"not a web asset"}
  }, ({webRoot, manifestPath}) => {
    assert.throws(
      () => auditCourseAssets({webRoot, manifestPath}),
      /escapes|outside.*web root/i
    );
  });
});

test("asset auditor reads the real src instead of a harmless data-src", () => {
  withFixture({
    html:'<img data-src="assets/allowed.png" src="../outside.png">',
    files:{
      "web/assets/allowed.png":"a nonempty local asset",
      "outside.png":"not a web asset"
    }
  }, ({webRoot, manifestPath}) => {
    assert.throws(
      () => auditCourseAssets({webRoot, manifestPath}),
      /escapes|outside.*web root/i
    );
  });
});

test("asset auditor rejects a base href that could rewrite an image address", () => {
  withFixture({
    html:'<base href="../"><img src="assets/allowed.png">',
    files:{"web/assets/allowed.png":"a nonempty local asset"}
  }, ({webRoot, manifestPath}) => {
    assert.throws(
      () => auditCourseAssets({webRoot, manifestPath}),
      /base.*href|base url/i
    );
  });
});

test("asset auditor ignores commented and script-string image markup", () => {
  withFixture({
    html:'<!-- <img src="../outside.png"> --><script>const markup = "<img src=\\"../outside.png\\">";</script><img src="assets/allowed.png">',
    files:{"web/assets/allowed.png":"a nonempty local asset"}
  }, ({webRoot, manifestPath}) => {
    const result = auditCourseAssets({webRoot, manifestPath});
    assert.equal(result.assets.length, 1);
    assert.equal(result.assets[0].source, "assets/allowed.png");
  });
});

test("asset auditor rejects remote and data image URIs", () => {
  for (const source of ["https://example.test/flea.png", "data:image/png;base64,AAAA"]) {
    withFixture({html:`<img src="${source}">`}, ({webRoot, manifestPath}) => {
      assert.throws(
        () => auditCourseAssets({webRoot, manifestPath}),
        /remote|data uri|local/i
      );
    });
  }
});

test("asset auditor rejects a manifest declaration that escapes web", () => {
  withFixture({
    manifest:"| File |\n| --- |\n| `web/../outside.png` |",
    files:{"outside.png":"not a web asset"}
  }, ({webRoot, manifestPath}) => {
    assert.throws(
      () => auditCourseAssets({webRoot, manifestPath}),
      /escapes|outside.*web root/i
    );
  });
});

test("asset-audit command prints its success sentinel for the checked-in course", {skip:checkedInManifestSkip}, () => {
  const result = childProcess.spawnSync(process.execPath, [toolPath], {
    cwd:repositoryRoot,
    encoding:"utf8"
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /COURSE_ASSETS_OK/);
});
