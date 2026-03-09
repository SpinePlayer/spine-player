export default {
  plugins: {
    'postcss-px-to-viewport': {
      viewportWidth: 750,
      unitPrecision: 5,
      viewportUnit: 'vw',
      selectorBlackList: [],
      minPixelValue: 1,
      mediaQuery: false,
      exclude: [/node_modules/]
    }
  }
}