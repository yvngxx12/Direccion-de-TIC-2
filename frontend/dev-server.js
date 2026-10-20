import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import parser from "@babel/parser";
import _traverse from "@babel/traverse";
import _generate from "@babel/generator";
import t from "@babel/types";

const traverse = _traverse.default || _traverse;
const generate = _generate.default || _generate;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 5173;

function jsxTagNameToExpr(nameNode) {
  if (t.isJSXIdentifier(nameNode)) {
    const name = nameNode.name;
    if (/^[a-z]/.test(name)) {
      return t.stringLiteral(name);
    }
    return t.identifier(name);
  }
  if (t.isJSXMemberExpression(nameNode)) {
    return t.memberExpression(
      jsxTagNameToExpr(nameNode.object),
      t.identifier(nameNode.property.name)
    );
  }
  return t.stringLiteral("div");
}

function jsxAttributesToObject(attributes) {
  if (!attributes || attributes.length === 0) {
    return t.nullLiteral();
  }
  const props = [];
  for (const attr of attributes) {
    if (t.isJSXSpreadAttribute(attr)) {
      props.push(t.spreadElement(attr.argument));
      continue;
    }
    const keyName = attr.name.name;
    const key = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(keyName)
      ? t.identifier(keyName)
      : t.stringLiteral(keyName);
    let val = t.booleanLiteral(true);
    if (attr.value) {
      if (t.isJSXExpressionContainer(attr.value)) {
        val = attr.value.expression;
      } else {
        val = attr.value;
      }
    }
    props.push(t.objectProperty(key, val));
  }
  return t.objectExpression(props);
}

function cleanJSXText(text) {
  const lines = text.split(/\r\n|\n|\r/);
  let lastNonEmptyLine = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/[^ \t]/.test(lines[i])) lastNonEmptyLine = i;
  }
  let str = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isFirstLine = i === 0;
    const isLastLine = i === lines.length - 1;
    const isLastNonEmptyLine = i === lastNonEmptyLine;
    let trimmedLine = line.replace(/\t/g, " ");
    if (!isFirstLine) trimmedLine = trimmedLine.replace(/^[ ]+/, "");
    if (!isLastLine) trimmedLine = trimmedLine.replace(/[ ]+$/, "");
    if (trimmedLine) {
      if (!isLastNonEmptyLine) trimmedLine += " ";
      str += trimmedLine;
    }
  }
  return str;
}

function transformJSXChildren(children) {
  const result = [];
  for (const child of children) {
    if (t.isJSXText(child)) {
      const cleaned = cleanJSXText(child.value);
      if (cleaned) result.push(t.stringLiteral(cleaned));
    } else if (t.isJSXExpressionContainer(child)) {
      if (!t.isJSXEmptyExpression(child.expression)) {
        result.push(child.expression);
      }
    } else if (!t.isJSXEmptyExpression(child)) {
      result.push(child);
    }
  }
  return result;
}

function compileJSX(code) {
  const ast = parser.parse(code, {
    sourceType: "module",
    plugins: ["jsx"]
  });

  traverse(ast, {
    ImportDeclaration(p) {
      const src = p.node.source.value;
      if (src === "react") {
        p.node.source.value = "/@modules/react.js";
      } else if (src === "react-dom/client") {
        p.node.source.value = "/@modules/react-dom-client.js";
      } else if (src === "socket.io-client") {
        p.node.source.value = "/@modules/socket.io-client.js";
      } else if (src.endsWith(".css")) {
        // Transform CSS import into dynamic stylesheet injection
        const href = src.startsWith(".") ? `/src/${src.replace(/^\.\//, "")}` : src;
        p.replaceWith(
          parser.parseExpression(
            `(() => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '${href}'; document.head.appendChild(l); })()`
          )
        );
      }
    },
    JSXElement: {
      exit(p) {
        const opening = p.node.openingElement;
        const tagExpr = jsxTagNameToExpr(opening.name);
        const propsExpr = jsxAttributesToObject(opening.attributes);
        const childrenExprs = transformJSXChildren(p.node.children);
        p.replaceWith(
          t.callExpression(
            t.memberExpression(t.identifier("React"), t.identifier("createElement")),
            [tagExpr, propsExpr, ...childrenExprs]
          )
        );
      }
    },
    JSXFragment: {
      exit(p) {
        const childrenExprs = transformJSXChildren(p.node.children);
        p.replaceWith(
          t.callExpression(
            t.memberExpression(t.identifier("React"), t.identifier("createElement")),
            [
              t.memberExpression(t.identifier("React"), t.identifier("Fragment")),
              t.nullLiteral(),
              ...childrenExprs
            ]
          )
        );
      }
    }
  });

  return generate(ast).code;
}

const server = http.createServer((req, res) => {
  const url = (req.url || "/").split("?")[0];

  if (url === "/" || url === "/index.html") {
    const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf-8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(html);
  }

  if (url === "/@modules/react.js") {
    const umd = fs.readFileSync(
      path.join(__dirname, "node_modules/react/umd/react.development.js"),
      "utf-8"
    );
    const esm = `${umd}\nconst R = window.React;\nexport default R;\nexport const { useState, useEffect, useRef, useMemo, useCallback, Fragment, StrictMode, createElement } = R;\n`;
    res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
    return res.end(esm);
  }

  if (url === "/@modules/react-dom-client.js") {
    const umd = fs.readFileSync(
      path.join(__dirname, "node_modules/react-dom/umd/react-dom.development.js"),
      "utf-8"
    );
    const esm = `import React from "/@modules/react.js";\nwindow.React = React;\n${umd}\nconst RD = window.ReactDOM;\nexport default RD;\nexport const { createRoot } = RD;\n`;
    res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
    return res.end(esm);
  }

  if (url === "/@modules/socket.io-client.js") {
    const esm = fs.readFileSync(
      path.join(__dirname, "node_modules/socket.io-client/dist/socket.io.esm.min.js"),
      "utf-8"
    );
    res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
    return res.end(esm);
  }

  const filePath = path.join(__dirname, url);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    if (filePath.endsWith(".jsx") || filePath.endsWith(".js")) {
      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        const compiled = compileJSX(raw);
        res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
        return res.end(compiled);
      } catch (err) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        return res.end(`Error compiling JSX: ${err.message}`);
      }
    }

    if (filePath.endsWith(".css")) {
      const css = fs.readFileSync(filePath, "utf-8");
      res.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
      return res.end(css);
    }
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`Frontend Dev Server listo en http://localhost:${PORT}`);
});

