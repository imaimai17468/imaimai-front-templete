import path from "node:path";
import { srcPathOf } from "./file-paths.js";
import { layerOf } from "./layers.js";

// A route file and a component are both reached through the browser build, so
// they carry the same bans.
const BROWSER_PATH_BANS = [
  {
    message:
      "Routes and components must not resolve request authentication. Delegate to a gateway.",
    target: "src/lib/auth/session",
  },
];

const PERSISTENCE_MESSAGE =
  "Routes and components must not touch persistence. D1, R2 and the schema are owned by gateways.";

// What Void hands the Worker: D1, R2, the schema and the secrets. Each is
// reached by a bare specifier, so the `src/lib` path ban never sees it.
const SERVER_RESOURCE_BANS = [
  { message: PERSISTENCE_MESSAGE, source: "void/db" },
  { message: PERSISTENCE_MESSAGE, source: "void/storage" },
  { message: PERSISTENCE_MESSAGE, source: "@schema" },
  {
    message:
      "Routes and components must not read the Worker's secrets. Delegate to a gateway.",
    source: "void/env",
  },
];

const BROWSER_EXTERNAL_BANS = [
  ...SERVER_RESOURCE_BANS,
  {
    message:
      "Routes and components must not access Cloudflare bindings directly. Delegate to a gateway.",
    source: "cloudflare:workers",
  },
  {
    message:
      "Routes and components must not resolve request context directly. Delegate to a gateway.",
    source: "@tanstack/react-start/server",
  },
];

// What each layer may not import. `paths` names a target by where it sits,
// `layers` by what `layerOf` calls it, which is what reaches a role directory
// at any depth, and `externals` by its bare specifier.
const LAYER_RULES = {
  adapter: {
    layers: [
      {
        layer: "route",
        message:
          "Adapters must not import routes. src/lib is read by the layers above it.",
      },
      {
        layer: "gateway",
        message:
          "Adapters must not import gateways. A gateway reaches src/lib, never the reverse.",
      },
      { layer: "component", message: "Adapters never import components." },
    ],
  },
  component: {
    externals: BROWSER_EXTERNAL_BANS,
    paths: BROWSER_PATH_BANS,
  },
  entity: {
    externals: SERVER_RESOURCE_BANS.map(({ source }) => ({
      message:
        "Entities import nothing from the layers above. D1, R2, the schema and the Worker's secrets belong to gateways.",
      source,
    })),
    layers: [
      {
        layer: "route",
        message:
          "Entities import nothing from the layers above. Routes are above entities.",
      },
      {
        layer: "gateway",
        message:
          "Entities import nothing from the layers above. Gateways are above entities.",
      },
      {
        layer: "component",
        message:
          "Entities import nothing from the layers above. A component reads entities, never the reverse.",
      },
    ],
    paths: [
      {
        message:
          "Entities import nothing from the layers above. A src/lib adapter reads entities, never the reverse.",
        target: "src/lib",
      },
    ],
  },
  gateway: {
    layers: [
      {
        layer: "route",
        message: "Gateways must not import routes. Imports flow downward only.",
      },
      { layer: "component", message: "Gateways never import components." },
    ],
  },
  route: {
    externals: BROWSER_EXTERNAL_BANS,
    paths: BROWSER_PATH_BANS,
  },
};

// `*.entry` は coverage 規約が付ける接尾辞で、付いていてもレイヤ上の位置は
// 変わらないので、ban の照合前に落とす。
const COVERAGE_NAME_SUFFIX = /\.entry$/u;

const resolveImportTarget = (fileSrcDir, specifier) => {
  if (specifier.startsWith("@/")) {
    return `src/${specifier.slice(2)}`.replace(COVERAGE_NAME_SUFFIX, "");
  }
  if (specifier.startsWith(".")) {
    return path.posix
      .join(fileSrcDir, specifier)
      .replace(COVERAGE_NAME_SUFFIX, "");
  }
  return null;
};

const PRIVATE_DIRECTORY_PREFIX = "-";

const ROUTES_ROOT = "src/routes";

/**
 * The directory that owns the first `-` directory on this path, or `null` when
 * the path holds none.
 *
 * The last segment is a module name rather than a directory, so a `-` file such
 * as `src/routes/api/-avatars.test.ts` owns nothing.
 */
const privateOwnerOf = (srcPath) => {
  const segments = srcPath.split("/");
  const index = segments
    .slice(0, -1)
    .findIndex((segment) => segment.startsWith(PRIVATE_DIRECTORY_PREFIX));
  return index === -1 ? null : segments.slice(0, index).join("/");
};

/**
 * Whether a module at `importerPath` may read one owned by `ownerPath`.
 *
 * A deeper owner is one route's directory, and every module under it shares
 * that route. `src/routes` is the URL space rather than a route, so its `-`
 * directories are read by the route files sitting directly in it (`__root.tsx`)
 * and by the modules inside a `-` directory at that level; `src/routes/login/
 * route.tsx` is a second route reaching in.
 */
const mayReadPrivate = (importerPath, ownerPath) => {
  if (!importerPath.startsWith(`${ownerPath}/`)) {
    return false;
  }
  if (ownerPath !== ROUTES_ROOT) {
    return true;
  }
  const rest = importerPath.slice(ownerPath.length + 1);
  return !rest.includes("/") || rest.startsWith(PRIVATE_DIRECTORY_PREFIX);
};

const layerBoundaries = {
  create(context) {
    const srcPath = srcPathOf(context);
    if (srcPath === null) {
      return {};
    }
    const fileSrcDir = srcPath.slice(0, srcPath.lastIndexOf("/"));

    const rules = LAYER_RULES[layerOf(srcPath)];
    if (rules === undefined) {
      return {};
    }

    const findViolationMessage = (specifier) => {
      const externalViolation = rules.externals?.find(
        (ban) =>
          specifier === ban.source || specifier.startsWith(`${ban.source}/`)
      );
      if (externalViolation !== undefined) {
        return externalViolation.message;
      }
      const target = resolveImportTarget(fileSrcDir, specifier);
      if (target === null) {
        return null;
      }
      const pathViolation = rules.paths?.find(
        (ban) => target === ban.target || target.startsWith(`${ban.target}/`)
      );
      if (pathViolation !== undefined) {
        return pathViolation.message;
      }
      const targetLayer = layerOf(target);
      const layerViolation = rules.layers?.find(
        (ban) => ban.layer === targetLayer
      );
      if (layerViolation !== undefined) {
        return layerViolation.message;
      }
      const owner = privateOwnerOf(target);
      if (owner === null || mayReadPrivate(srcPath, owner)) {
        return null;
      }
      const scope =
        owner === ROUTES_ROOT
          ? `the route files directly in \`${owner}/\``
          : `\`${owner}/\``;
      return `A \`-\` directory is private to ${scope}. A second route reaching this module makes it shared, so move it to \`src/shared/\`.`;
    };

    const checkImportSource = (node) => {
      const { source } = node;
      if (!source || typeof source.value !== "string") {
        return;
      }
      const message = findViolationMessage(source.value);
      if (message !== null) {
        context.report({ message, node });
      }
    };

    return {
      ExportAllDeclaration: checkImportSource,
      ExportNamedDeclaration: checkImportSource,
      ImportDeclaration: checkImportSource,
      ImportExpression: checkImportSource,
    };
  },
};

export default layerBoundaries;
