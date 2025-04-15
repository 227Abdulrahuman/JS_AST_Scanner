#!/usr/bin/env node

const fs = require("fs");
const minimist = require("minimist");
const { parse } = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const cheerio = require("cheerio");

const args = minimist(process.argv.slice(2));
const url = args.url;
const filePath = args.file;
const rulesPath = args.rules;

if ((!url && !filePath) || !rulesPath) {
  console.error("❌ Usage: node parser.js --url <URL> --file <filePath> --rules <rules.txt>");
  process.exit(1);
}

// Load rules
let rules = [];
try {
  rules = fs.readFileSync(rulesPath, "utf-8")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);
} catch (e) {
  console.error(`❌ Failed to read rules file: ${e.message}`);
  process.exit(1);
}

// Function to fetch content from a URL
const fetchContent = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  return res.text();
};

// Function to process the content
const processContent = (content, isHtml) => {
  console.log(`🔍 Scanning content with rules from ${rulesPath}...\n`);

  // Handle HTML content and extract <script> tags if it's HTML
  if (isHtml) {
    const $ = cheerio.load(content);
    const scripts = $("script").map((i, el) => $(el).html()).get();

    let found = false;

    scripts.forEach((scriptContent, idx) => {
      const ast = parse(scriptContent, {
        sourceType: "unambiguous",
        plugins: ["jsx"]
      });

      traverse(ast, {
        MemberExpression(path) {
          const objectName = path.node.object.name;
          const prop = path.node.property;
          const propertyName = prop.name || (prop.value ?? "");
          const fullAccess = `${objectName}.${propertyName}`;

          // Check for matching rules for property access
          for (const rule of rules) {
            if (rule.startsWith("element.") && fullAccess.startsWith("element")) {
              const ruleProp = rule.split(".")[1];
              if (
                ruleProp === propertyName || // exact match
                (ruleProp === "onevent" && propertyName.startsWith("on")) // wildcard
              ) {
                const { line, column } = path.node.loc.start;
                console.log(`⚠️ Rule match "${rule}" at script ${idx + 1}, line ${line}, column ${column}: ${fullAccess}`);
                found = true;
              }
            } else if (rule === propertyName || fullAccess === rule) {
              const { line, column } = path.node.loc.start;
              console.log(`⚠️ Rule match "${rule}" at script ${idx + 1}, line ${line}, column ${column}: ${fullAccess}`);
              found = true;
            }
          }
        },

        AssignmentExpression(path) {
          const left = path.node.left;
          if (left.type === "MemberExpression") {
            const objectName = left.object.name;
            const prop = left.property;
            const propertyName = prop.name || (prop.value ?? "");
            const fullAccess = `${objectName}.${propertyName}`;

            // Check for matching rules for property assignment
            for (const rule of rules) {
              if (rule.startsWith("element.") && fullAccess.startsWith("element")) {
                const ruleProp = rule.split(".")[1];
                if (
                  ruleProp === propertyName || // exact match
                  (ruleProp === "onevent" && propertyName.startsWith("on")) // wildcard
                ) {
                  const { line, column } = left.loc.start;
                  console.log(`⚠️ Rule match "${rule}" at script ${idx + 1}, line ${line}, column ${column}: ${fullAccess}`);
                  found = true;
                }
              } else if (rule === propertyName || fullAccess === rule) {
                const { line, column } = left.loc.start;
                console.log(`⚠️ Rule match "${rule}" at script ${idx + 1}, line ${line}, column ${column}: ${fullAccess}`);
                found = true;
              }
            }
          }
        },

        CallExpression(path) {
          const callee = path.node.callee;
          if (callee.type === "Identifier" && rules.includes(callee.name)) {
            const { line, column } = path.node.loc.start;
            console.log(`⚠️ Rule match "${callee.name}" at script ${idx + 1}, line ${line}, column ${column}`);
            found = true;
          }

          // Detect jQuery-style method calls like $("#id").html()
          if (callee.type === "MemberExpression") {
            const prop = callee.property.name || callee.property.value;
            if (rules.includes(prop)) {
              const { line, column } = callee.loc.start;
              console.log(`⚠️ Rule match ".${prop}()" at script ${idx + 1}, line ${line}, column ${column}`);
              found = true;
            }
          }
        }
      });
    });

    if (!found) {
      console.log("✅ No issues found based on the provided rules.");
    }

  } else {
    // Handle JS content (direct JavaScript file)
    const ast = parse(content, {
      sourceType: "unambiguous",
      plugins: ["jsx"]
    });

    let found = false;

    traverse(ast, {
      MemberExpression(path) {
        const objectName = path.node.object.name;
        const prop = path.node.property;
        const propertyName = prop.name || (prop.value ?? "");
        const fullAccess = `${objectName}.${propertyName}`;

        // Check for matching rules for property access
        for (const rule of rules) {
          if (rule.startsWith("element.") && fullAccess.startsWith("element")) {
            const ruleProp = rule.split(".")[1];
            if (
              ruleProp === propertyName || // exact match
              (ruleProp === "onevent" && propertyName.startsWith("on")) // wildcard
            ) {
              const { line, column } = path.node.loc.start;
              console.log(`⚠️ Rule match "${rule}" at line ${path.node.loc.start.line}, column ${path.node.loc.start.column}: ${fullAccess}`);
              found = true;
            }
          } else if (rule === propertyName || fullAccess === rule) {
            const { line, column } = path.node.loc.start;
            console.log(`⚠️ Rule match "${rule}" at line ${line}, column ${column}: ${fullAccess}`);
            found = true;
          }
        }
      },

      AssignmentExpression(path) {
        const left = path.node.left;
        if (left.type === "MemberExpression") {
          const objectName = left.object.name;
          const prop = left.property;
          const propertyName = prop.name || (prop.value ?? "");
          const fullAccess = `${objectName}.${propertyName}`;

          // Check for matching rules for property assignment
          for (const rule of rules) {
            if (rule.startsWith("element.") && fullAccess.startsWith("element")) {
              const ruleProp = rule.split(".")[1];
              if (
                ruleProp === propertyName || // exact match
                (ruleProp === "onevent" && propertyName.startsWith("on")) // wildcard
              ) {
                const { line, column } = left.loc.start;
                console.log(`⚠️ Rule match "${rule}" at line ${path.node.loc.start.line}, column ${path.node.loc.start.column}: ${fullAccess}`);
                found = true;
              }
            } else if (rule === propertyName || fullAccess === rule) {
              const { line, column } = left.loc.start;
              console.log(`⚠️ Rule match "${rule}" at line ${path.node.loc.start.line}, column ${path.node.loc.start.column}: ${fullAccess}`);
              found = true;
            }
          }
        }
      },

      CallExpression(path) {
        const callee = path.node.callee;
        if (callee.type === "Identifier" && rules.includes(callee.name)) {
          const { line, column } = path.node.loc.start;
          console.log(`⚠️ Rule match "${callee.name}" at line ${path.node.loc.start.line}, column ${path.node.loc.start.column}`);
          found = true;
        }

        // Detect jQuery-style method calls like $("#id").html()
        if (callee.type === "MemberExpression") {
          const prop = callee.property.name || callee.property.value;
          if (rules.includes(prop)) {
            const { line, column } = callee.loc.start;
            console.log(`⚠️ Rule match ".${prop}()" at line ${path.node.loc.start.line}, column ${path.node.loc.start.column}`);
            found = true;
          }
        }
      }
    });

    if (!found) {
      console.log("✅ No issues found based on the provided rules.");
    }
  }
};

// Decide where the content comes from: URL or file
if (url) {
  fetchContent(url)
    .then(content => processContent(content, content.includes("<script")))
    .catch(err => console.error(`❌ Error fetching URL: ${err.message}`));
} else if (filePath) {
  fs.readFile(filePath, "utf-8", (err, content) => {
    if (err) {
      console.error(`❌ Error reading file: ${err.message}`);
      return;
    }
    processContent(content, content.includes("<script"));
  });
}
