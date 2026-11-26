require('@babel/register')({
	babelrc: false,
	configFile: false,
	presets: [[require.resolve('@babel/preset-env'), { targets: { node: 'current' } }]],
});
