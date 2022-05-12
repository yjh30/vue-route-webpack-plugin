const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const glob = require('glob');
const shelljs = require('shelljs');

// 获取子目录路径
function getSubDirectory(dir) {
  if (dir.indexOf('./') !== -1) {
    dir = dir.substring(dir.indexOf('.') + 2);
  }
  return dir.substring(dir.indexOf('/') + 1);
}

class VueRouteWebpackPlugin {
  constructor(options = {}) {
    // import 的路径前缀
    this.prefix = options.prefix || '../';
    if (this.prefix.lastIndexOf('/') === -1) {
      this.prefix += '/';
    }
    // 扫描目录
    this.directory = options.directory || `src/views`;
    // 路由文件存放路径
    this.routeFilePath = options.routeFilePath || `src/router/children.js`;
    // 生成的文件中是否使用双引号规范，默认使用
    this.doubleQoute = options.doubleQoute === undefined ? true : !!options.doubleQoute;
    this.qoute = this.doubleQoute ? '"' : "'";
    this.loadAsync = typeof options.loadAsync === 'boolean' ? options.loadAsync : false;
  }

  apply(compiler) {
    compiler.hooks.afterPlugins.tap('VueRouteWebpackPlugin', () => {
      const allData = this.parseRouteData();
      this.writeRouteFile(allData);
      console.log('路由文件生成成功');
      if (process.env.NODE_ENV === 'development') {
        const watcher = chokidar.watch(path.resolve(this.directory), {
          ignored: /(^|[\/\\])\../,
          persistent: true
        });

        watcher.on('change', () => {
          const allData = this.parseRouteData();
          this.writeRouteFile(allData);
          console.log('路由文件生成成功');
        })
      }
    })
  }

  parseRouteData() {
    const files = glob.sync(path.join('.', this.directory) + '/**/*.vue');
    const routeData = [];
    const importData = new Set;
    files.forEach(filePath => {
      let content = fs.readFileSync(path.resolve(filePath), 'utf8');
      content = content.substring(content.indexOf('<script>'), content.lastIndexOf('export default'));
      const contentArr = content.split('');
      const parseRoute = require('./utils/parse-route');
      const parseData = parseRoute(contentArr);
      const subFilePath = getSubDirectory(filePath);

      let componentName = '';
      parseData.forEach(item => {
        if (componentName === '') {
          componentName = item.path.replace(/[\/:?*\\\-'"]/g, '');
        }
        componentName = componentName || path.parse(filePath).name;
        if (!this.loadAsync) {
          importData.add(`import ${componentName} from ${this.qoute}${this.prefix}${subFilePath}${this.qoute};`.replace(/\\/g, '/'))
        } else {
          importData.add(`const ${componentName} = () => import(${this.qoute}${this.prefix}${subFilePath}${this.qoute});`.replace(/\\/g, '/'))
        }
        item.component = componentName;
        routeData.push({ ...item });
      })
    })
    return {routeData, importData}
  }

  writeRouteFile(allData) {
    let routeString = '';
    allData.importData.forEach(item => {
      routeString += `${item}\n`;
    });
    routeString += '\nexport default [\n';
    allData.routeData.forEach(item => {
      routeString += `  {\n`;
      Object.keys(item).forEach(key => {
        const val = item[key];
        if (typeof val === 'object') {
          routeString += `    ${key}:{\n`;
          Object.keys(val).forEach(k => {
            routeString += `      ${k}: ${val[k]},\n`;
          })
          routeString += '    },\n';
        } else {
          routeString += `    ${key}: ${val},\n`;
        }
      });
      routeString += '  },\n';
    })
    routeString += '];\n';
    
    if (!fs.existsSync(path.resolve(this.routeFilePath, '..'))) {
      shelljs.mkdir('-p', path.resolve(this.routeFilePath, '..'));
    }
    fs.writeFileSync(path.resolve(this.routeFilePath), routeString);
  }
}

module.exports = VueRouteWebpackPlugin;
