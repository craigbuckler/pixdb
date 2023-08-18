import * as esbuild from 'esbuild';
import pkg from './package.json' assert {type: 'json'};

await esbuild.build({
  entryPoints: [ './src/pixdb.js' ],
  format: 'esm',
  platform: 'browser',
  bundle: true,
  target: 'chrome100,firefox100,safari15'.split(','),
  drop: ['debugger', 'console'],
  banner: { js: `/*\n${ pkg.name } ${ pkg.version } - ${ pkg.description }\n${ pkg.homepage }\n${ pkg.author }, ${ (new Date()).toISOString().slice(0,10) }\n*/` },
  logLevel: 'error',
  minify: true,
  sourcemap: false,
  outdir: './dist/'
});
