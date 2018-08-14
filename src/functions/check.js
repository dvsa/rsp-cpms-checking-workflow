export default (event, context, callback) => {
	console.log('Logging incoming event');
	console.log(event);
	callback(null, 'success');
};
