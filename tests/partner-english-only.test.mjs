import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

test("partner requests ignore the administrator Korean locale", async () => {
  const middleware = await readSource("src/middleware.ts");
  const translator = await readSource("src/components/GlobalTextTranslator.tsx");
  const shell = await readSource("src/components/agency/PartnerWorkspaceShell.tsx");

  assert.match(middleware, /requestHeaders\.set\("x-jht-locale", "en"\)/);
  assert.match(translator, /locale !== "ko" \|\| isAgencySurface/);
  assert.match(shell, /document\.documentElement\.lang = "en-US"/);
  assert.match(shell, /lang="en-US"/);
});

test("partner page UI source contains no Korean display text", async () => {
  const sourceFiles = [
    ...(await listSourceFiles("src/app/agency")),
    ...(await listSourceFiles("src/components/agency")),
    "src/components/workflow/WorkflowLedger.tsx"
  ];

  for (const file of sourceFiles) {
    const displaySource = stripComments(await readSource(file));
    assert.doesNotMatch(displaySource, /[가-힣]/, `${file} contains Korean partner-facing text`);
  }
});

test("partner-facing locale formatting is explicitly English", async () => {
  const workflowLedger = await readSource("src/components/workflow/WorkflowLedger.tsx");
  assert.match(workflowLedger, /toLocaleString\("en-US"/);

  for (const file of await listSourceFiles("src/app/agency")) {
    const source = await readSource(file);
    assert.doesNotMatch(source, /toLocale(?:String|DateString|TimeString)\(\)/, `${file} uses the browser locale`);
  }
});

async function listSourceFiles(relativeDirectory) {
  const directory = path.join(repositoryRoot, relativeDirectory);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.posix.join(relativeDirectory.replaceAll("\\", "/"), entry.name);
    if (entry.isDirectory()) files.push(...(await listSourceFiles(relativePath)));
    if (entry.isFile() && /\.(?:ts|tsx|mjs)$/.test(entry.name)) files.push(relativePath);
  }
  return files;
}

async function readSource(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), "utf8");
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}
