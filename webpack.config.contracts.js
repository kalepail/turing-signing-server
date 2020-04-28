const path = require('path')
const glob = require('glob')
const TerserPlugin = require('terser-webpack-plugin')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const { last } = require('lodash')

const entryArray = glob.sync('./contracts/src/*.js')

const entryObject = entryArray.reduce((acc, item) => {
  const name = last(item.split('/')).replace('.js', '')
  acc[name] = item
  return acc
}, {})

module.exports = {
  mode: 'production',
  target: 'node',
  entry: entryObject,
  output: {
    path: path.resolve(__dirname, 'contracts/dist'),
    libraryExport: 'default',
    libraryTarget: 'commonjs-module',
    filename: '[name].js'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env']
            }
          }
        ]
      }
    ]
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin()
    ]
  },
  plugins: [
    new CleanWebpackPlugin(),
  ]
}
