const slsw = require('serverless-webpack')
const nodeExternals = require('webpack-node-externals')
const path = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin')

const ConditionalPlugin = (condition, plugin) => ({
  apply: compiler => {
    const name = Object.keys(compiler.options.entry)[0].split('/').pop()
    const config = Object.assign({webpack: {}}, slsw.lib.serverless.service.getFunction(name))

    if (condition(config))
      plugin.apply(compiler)
  }
})

module.exports = {
  stats: 'minimal',
  entry: slsw.lib.entries,
  output: {
    libraryTarget: 'commonjs-module',
    path: path.resolve(__dirname, '.webpack'),
    filename: '[name].js',
  },
  target: 'node',
  devtool: 'source-map',
  externals: [nodeExternals()],
  mode: slsw.lib.webpack.isLocal ? 'development' : 'production',
  optimization: {
    minimize: true
  },
  performance: {
    hints: false
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        include: __dirname,
        exclude: /node_modules/
      }
    ]
  },
  plugins: [
    ConditionalPlugin(
      ((config) => config.webpack.toml),
      new CopyWebpackPlugin({patterns: [{ from: 'stellar.toml' }]})
    )
  ]
}