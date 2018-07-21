const fs = require("fs");
const path = require("path");
const babelParser = require("@babel/parser");
const babelTraverse = require("babel-traverse");
const { transformFromAst } = require("babel-core");

function createAsset(filename) {
  let getData = fs.readFileSync(filename, "utf-8");
  let ast = babelParser.parse(getData, {
    sourceType: "module"
  });
  const dependencies = [];

  let genrateDependencies = babelTraverse.default(ast, {
    ImportDeclaration: ({ node }) => {
      dependencies.push(node.source.value);
    }
  });

  let { code } = transformFromAst(ast, null, {
      presets: ["env"]
  });
  return {
    filename,
    dependencies,
    code
  };
}

function dependencyGraph(entry) {
  const initialAsset = createAsset(entry);

  //collecting all assets
  const assets = [initialAsset];

  for (const asset of assets) {
    const dirname = path.dirname(asset.filename);

    asset.dependencies.forEach(relativePath => {
      // getting the extension name of file
      const extname = path.extname(asset.filename);

      //generating the absolute path
      const absolutePath = path.join(dirname, relativePath + extname);
      const childAsset = createAsset(absolutePath);
      childAsset.filename = relativePath + extname;
      assets.push(childAsset);
    });
  }

  return assets;
}

function bundle(graph) {
  let modules = [];

  graph.forEach(mod => {
    modules += `${JSON.stringify(mod.filename.replace(/.js$/gi, ""))}: [
      function ( module, exports,require) {
        ${mod.code}
      }
    ],`;
  });

  var result = `(function (modules) {
    function require(name) {
      const [fn] = modules[name];
      const module = {},exports={};
      fn(module, exports,(name)=>require(name));
      return exports;
    }
    require("./getSum");
  })({${modules}})`;

  return result;
}

const graph = dependencyGraph("./getSum.js");

if (fs.existsSync("./bundle.js")) {
  fs.unlinkSync("./bundle.js");
}

fs.appendFile("bundle.js", bundle(graph), err => {
  if (err) throw err;
  console.log("bundle.js created");
});
