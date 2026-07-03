import * as ts from "typescript";
import * as path from "node:path";
import * as fs from "node:fs";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_PATH = path.join(ROOT, ".claude", "code-graph.json");

const LAYER_RULES: ReadonlyArray<{ pattern: RegExp; layer: string }> = [
  { pattern: /^src\/routes\//, layer: "route" },
  { pattern: /^src\/components\//, layer: "component" },
  { pattern: /^src\/server\//, layer: "server" },
  { pattern: /^src\/gateways\//, layer: "gateway" },
  { pattern: /^src\/entities\//, layer: "entity" },
  { pattern: /^src\/lib\//, layer: "lib" },
  { pattern: /^src\/test[/-]/, layer: "test" },
];

export function classifyLayer(filePath: string): string {
  const match = LAYER_RULES.find((rule) => rule.pattern.test(filePath));
  return match ? match.layer : "config";
}

export function buildGraph(): {
  version: 1;
  generated_at: string;
  nodes: Record<
    string,
    { layer: string; imports: string[]; imported_by: string[] }
  >;
} {
  const configPath = ts.findConfigFile(
    ROOT,
    (p) => ts.sys.fileExists(p),
    "tsconfig.json"
  );
  if (!configPath) throw new Error("tsconfig.json not found");

  const configFile = ts.readConfigFile(configPath, (p) => ts.sys.readFile(p));
  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    ROOT
  );

  const srcFiles = parsedConfig.fileNames.filter((f) => {
    const rel = path.relative(ROOT, f);
    return (
      rel.startsWith("src/") &&
      !rel.endsWith(".d.ts") &&
      !rel.includes("routeTree.gen")
    );
  });

  const program = ts.createProgram(srcFiles, parsedConfig.options);
  const nodes: Record<
    string,
    { layer: string; imports: string[]; imported_by: string[] }
  > = {};

  srcFiles.forEach((filePath) => {
    const rel = path.relative(ROOT, filePath);
    nodes[rel] = { layer: classifyLayer(rel), imports: [], imported_by: [] };
  });

  const srcFileSet = new Set(srcFiles.map((f) => path.relative(ROOT, f)));

  srcFiles.forEach((filePath) => {
    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) return;

    const rel = path.relative(ROOT, filePath);

    ts.forEachChild(sourceFile, (node) => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const specifier = node.moduleSpecifier.text;
        const resolved = ts.resolveModuleName(
          specifier,
          filePath,
          parsedConfig.options,
          ts.sys
        );

        if (
          resolved.resolvedModule &&
          !resolved.resolvedModule.isExternalLibraryImport
        ) {
          const resolvedRel = path.relative(
            ROOT,
            resolved.resolvedModule.resolvedFileName
          );
          if (srcFileSet.has(resolvedRel) && resolvedRel !== rel) {
            nodes[rel].imports.push(resolvedRel);
          }
        }
      }
    });
  });

  Object.entries(nodes).forEach(([filePath, node]) => {
    node.imports.forEach((imp) => {
      if (nodes[imp]) {
        nodes[imp].imported_by.push(filePath);
      }
    });
  });

  Object.values(nodes).forEach((node) => {
    node.imports.sort();
    node.imported_by.sort();
  });

  return {
    version: 1 as const,
    generated_at: new Date().toISOString(),
    nodes,
  };
}

if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("build-graph.ts")
) {
  const graph = buildGraph();
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(graph, null, 2) + "\n");
  const nodeCount = Object.keys(graph.nodes).length;
  const edgeCount = Object.values(graph.nodes).reduce(
    (sum, n) => sum + n.imports.length,
    0
  );
  // eslint-disable-next-line no-console
  console.log(
    `code-graph: ${nodeCount} nodes, ${edgeCount} edges -> ${OUT_PATH}`
  );
}
