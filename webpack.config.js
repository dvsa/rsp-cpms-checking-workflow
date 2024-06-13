const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
	entry: {
		handler: './src/handler.js',
	},
	output: {
		filename: 'app.js',
		// library: 'handler',
		libraryTarget: 'commonjs2',
		path: path.resolve(__dirname, 'build'),
	},
	resolve: {
		extensions: ['.js'],
	},
	target: 'node',
	node: {
		__dirname: false,
		__filename: false,
	},
	mode: 'development',
	externals: [{ fsevents: "require('fsevents')" }],
	module: {
		rules: [
			{
				test: /\.m?js$/,
				exclude: /node_modules/,
				use: {
					loader: 'babel-loader',
					options: {
						presets: [
							['@babel/preset-env'],
						],
					},
				},
			},
		],
	},
	plugins: [
		new CopyWebpackPlugin({
			patterns: [
				{ from: 'serverless/serverless.yml', to: `${path.resolve(__dirname, 'build')}` },
			],
		}),
	],
};
