/* eslint-disable */
// icons set: https://www.figma.com/file/Puuw2twGfuTU9RcY5CVp1Q/CloudSal-Icons

const fs = require('fs');
const { promisify } = require('util');
const { extname, resolve } = require('path');
const svgSpreact = require('svg-spreact');

// constants
const ICONS_DIR = resolve(__dirname, '../../assets/icons');
const OUTPUT_FILE = resolve(__dirname, './iconsDefs.svg');
const OUTPUT_TYPES = resolve(__dirname, './iconsDefs.ts');
const REMOVE_FILL_COLOR = '#333';
const ICON_PREFIX = 'ui-icon-';

const svgoConfig = {
  plugins: [
    { removeStyleElement: true },
    { removeScriptElement: true },
    { removeViewBox: false },
    { removeTitle: false },
    {
      removeAttrs: {
        attrs: [
          '(class|style)',
          'svg:width',
          'svg:height',
          'svg:fill',
          'aria-labelledby',
          'aria-describedby',
          'xmlns:xlink',
          'xmlns',
          'data-name',
        ],
      },
    },
  ],
  multipass: true,
};

const readFileAsync = promisify(fs.readFile);
const readDirAsync = promisify(fs.readdir);

const readFolder = async folder => {
  let svgs = [];
  const files = await readDirAsync(folder);
  const filtered = files.filter(file => extname(file) === '.svg');
  const filenames = filtered.map(file => file.replace('.svg', ''));
  for (file of filtered) {
    const data = await readFileAsync(resolve(folder, file));
    svgs = [...svgs, data.toString()];
  }
  return Promise.resolve({ svgs, filenames });
};

const doSprite = async ({ svgs, filenames }) => {
  const processId = n => `${ICON_PREFIX}${filenames[n]}`;
  const { defs } = await svgSpreact(svgs, { tidy: true, processId, svgoConfig });
  const svgData = defs.replace(new RegExp(`\\s*fill="${REMOVE_FILL_COLOR}"`, 'gm'), '');
  const typeData = doTypes(filenames);

  return { typeData, svgData };
};

const doTypes = filenames => {
  const array = `[${filenames.reduce((acc, name) => acc + `\n  '${name}',`, '')}\n]`;
  const list = `export const iconsList = ${array} as const;\n`;
  const type = `export type TIconType = typeof iconsList[number];\n`;

  return [list, type].join('\n');
};

readFolder(ICONS_DIR)
  .then(doSprite)
  .then(({ svgData, typeData }) => {
    fs.writeFileSync(OUTPUT_FILE, svgData);
    fs.writeFileSync(OUTPUT_TYPES, typeData);
  });
