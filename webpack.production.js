const path = require('path');
const fs = require('fs-extra');
const archiver = require('archiver');
const common = require('./webpack.config');
const lambdaNames = require('./lambdas.json');

const OUTPUT_FOLDER = './dist';

class BundlePlugin {
	/**
     * @param {{ archives: any; assets?: any; }} params
     */
	constructor(params) {
		this.archives = params.archives;
		this.assets = params.assets || [];
	}

	apply(compiler) {
		compiler.hooks.afterEmit.tapPromise('zip-pack-plugin', async () => {
			await Promise.all(this.archives.map((archive) => BundlePlugin.createArchive(
				archive.inputPath,
				archive.outputPath,
				archive.outputName,
				archive.ignore,
			)));

			this.assets.forEach((asset) => {
				fs.copySync(asset.inputPath, asset.outputPath);
			});
		});
	}

	static async createArchive(inputPath, outputPath, outputName, ignore) {
		fs.ensureDirSync(outputPath);
		const output = fs.createWriteStream(`${outputPath}/${outputName}.zip`);
		const archive = archiver('zip');
		const outputClosed = new Promise((resolve, reject) => {
			output.once('close', resolve);
			output.once('error', reject);
			archive.once('error', (err) => output.destroy(err));
		});

		archive.pipe(output);
		archive.glob(
			'**/*',
			{
				cwd: inputPath,
				ignore,
			},
		);
		try {
			await Promise.all([
				Promise.resolve().then(() => archive.finalize()),
				outputClosed,
			]);
		} catch (err) {
			output.destroy();
			throw err;
		}
		console.log(`${archive.pointer()} total bytes`);
		console.log('archiver has been finalized and the output file descriptor has closed.');
	}
}

module.exports = () => {
	const entry = Object.fromEntries(
		lambdaNames.lambdas.map((lambdaName) => [
			lambdaName,
			`./src/functions/${lambdaName}.js`,
		]),
	);

	return {
		...common,
		mode: 'production',
		entry,
		output: {
			...common.output,
			filename: '[name]/app.js',
			path: path.resolve(__dirname, '.webpack'),
			asyncChunks: false,
		},
		optimization: {
			splitChunks: false,
			runtimeChunk: false,
		},
		plugins: [
			new BundlePlugin({
				archives: lambdaNames.lambdas.map((lambdaName) => ({
					inputPath: `.webpack/${lambdaName}`,
					outputPath: OUTPUT_FOLDER,
					outputName: lambdaName,
				})),
			}),
		],
	};
};
